import ExpoModulesCore
import ARKit
import UIKit
import Vision

/// LiDAR wall capture. `isSupported()` says whether this iPhone has a LiDAR scanner.
/// `capture()` opens a full-screen ARKit camera; when the person taps the shutter it resolves with
/// a portrait JPEG (file URI), the depth map (Float32 meters, base64), its confidence map (UInt8,
/// base64), the camera intrinsics and the camera's pose in gravity-aligned world space. Rejects with
/// code E_CANCELED if they close it. The math (wall angle, hold distances) happens in JavaScript.
public class WallDepthModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WallDepth")

    Function("isSupported") { () -> Bool in
      return ARWorldTrackingConfiguration.isSupported
        && ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    }

    AsyncFunction("capture") { (promise: Promise) in
      DispatchQueue.main.async {
        WallDepthModule.present(multi: false, promise: promise)
      }
    }

    // On-phone "segment anything": the outline of the object under each point (x, y in 0...1). Empty entries
    // mean nothing was found at that point. Throws away nothing and sends nothing off the phone.
    Function("canSegment") { () -> Bool in
      return HoldSegmenter.isAvailable()
    }

    AsyncFunction("segmentHolds") { (uri: String, points: [[Double]]) -> [[String: Any]]? in
      do {
        return try HoldSegmenter.shared.run(uri: uri, points: points)
      } catch {
        return nil
      }
    }

    // Apple Vision's object finder (iOS 17+): one byte per pixel, 0 is background and 1, 2, 3... are separate
    // objects, as base64 at a modest size. Null when this iPhone can't do it. Runs on the phone.
    AsyncFunction("instanceMask") { (uri: String, maxEdge: Int) -> [String: Any]? in
      guard #available(iOS 17.0, *) else { return nil }
      guard let url = URL(string: uri),
            let data = try? Data(contentsOf: url),
            let source = UIImage(data: data) else { return nil }
      let longest = max(source.size.width, source.size.height)
      let scale = min(1, CGFloat(maxEdge) / longest)
      let size = CGSize(width: source.size.width * scale, height: source.size.height * scale)
      let format = UIGraphicsImageRendererFormat.default()
      format.scale = 1
      let drawn = UIGraphicsImageRenderer(size: size, format: format).image { _ in
        source.draw(in: CGRect(origin: .zero, size: size))
      }
      guard let cgImage = drawn.cgImage else { return nil }

      let request = VNGenerateForegroundInstanceMaskRequest()
      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      try handler.perform([request])
      guard let observation = request.results?.first else { return nil }

      let buffer = observation.instanceMask
      CVPixelBufferLockBaseAddress(buffer, .readOnly)
      defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
      let width = CVPixelBufferGetWidth(buffer)
      let height = CVPixelBufferGetHeight(buffer)
      let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
      guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
      let rows = base.assumingMemoryBound(to: UInt8.self)
      var packed = Data(count: width * height)
      packed.withUnsafeMutableBytes { raw in
        guard let out = raw.bindMemory(to: UInt8.self).baseAddress else { return }
        for y in 0..<height {
          memcpy(out + y * width, rows + y * bytesPerRow, width)
        }
      }
      return ["width": width, "height": height, "data": packed.base64EncodedString()]
    }

    // Tall walls: the camera stays open for several shots in one ARKit session (so the shots share a
    // world and their poses can be combined) and resolves with { shots: [...] } when the person taps Done.
    AsyncFunction("captureSections") { (promise: Promise) in
      DispatchQueue.main.async {
        WallDepthModule.present(multi: true, promise: promise)
      }
    }
  }

  static func present(multi: Bool, promise: Promise) {
    guard let presenter = WallDepthModule.topViewController() else {
      promise.reject("E_NO_UI", "Could not open the scanner.")
      return
    }
    let scanner = ScanViewController()
    scanner.multi = multi
    scanner.modalPresentationStyle = .fullScreen
    scanner.onFinish = { result in
      switch result {
      case .success(let payload):
        promise.resolve(payload)
      case .failure(let error):
        if let scanError = error as? ScanError, scanError == .canceled {
          promise.reject("E_CANCELED", "Canceled")
        } else {
          promise.reject("E_SCAN", error.localizedDescription)
        }
      }
    }
    presenter.present(scanner, animated: true)
  }

  static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first(where: { $0.activationState == .foregroundActive })
    var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }
}

enum ScanError: LocalizedError, Equatable {
  case canceled
  case noDepth
  case encoding

  var errorDescription: String? {
    switch self {
    case .canceled: return "Canceled"
    case .noDepth: return "No depth yet. Move the phone a little and try again."
    case .encoding: return "Could not save the scan."
    }
  }
}

final class ScanViewController: UIViewController {
  var onFinish: ((Result<[String: Any], Error>) -> Void)?
  /// Tall-wall mode: each tap of the shutter adds a shot and the camera stays open until Done.
  var multi = false
  private var shots: [[String: Any]] = []
  private static let maxShots = 8
  private let doneButton = UIButton(type: .system)

  private let sceneView = ARSCNView()
  private let hint = UILabel()
  private var finished = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black

    sceneView.frame = view.bounds
    sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(sceneView)

    hint.text = multi
      ? "Tall wall: stand 3 to 5 m back and start at the bottom. Tap the button, then raise the phone (or step back) so the next view overlaps the last by about a third. Repeat to the top, then tap Done."
      : "Stand 2 to 4 m from the wall with the route in view, then tap the button."
    hint.textColor = .white
    hint.font = .systemFont(ofSize: 15, weight: .semibold)
    hint.numberOfLines = 0
    hint.textAlignment = .center
    hint.backgroundColor = UIColor.black.withAlphaComponent(0.45)
    hint.layer.cornerRadius = 12
    hint.clipsToBounds = true
    hint.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(hint)

    let cancel = UIButton(type: .system)
    cancel.setTitle("Cancel", for: .normal)
    cancel.setTitleColor(.white, for: .normal)
    cancel.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
    cancel.backgroundColor = UIColor.black.withAlphaComponent(0.45)
    cancel.layer.cornerRadius = 18
    cancel.contentEdgeInsets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
    cancel.translatesAutoresizingMaskIntoConstraints = false
    cancel.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
    view.addSubview(cancel)

    doneButton.setTitle("Done", for: .normal)
    doneButton.setTitleColor(.white, for: .normal)
    doneButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
    doneButton.backgroundColor = UIColor.black.withAlphaComponent(0.45)
    doneButton.layer.cornerRadius = 18
    doneButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
    doneButton.translatesAutoresizingMaskIntoConstraints = false
    doneButton.isHidden = true
    doneButton.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)
    view.addSubview(doneButton)

    let shutter = UIButton(type: .custom)
    shutter.backgroundColor = .white
    shutter.layer.cornerRadius = 35
    shutter.layer.borderWidth = 4
    shutter.layer.borderColor = UIColor.black.withAlphaComponent(0.25).cgColor
    shutter.translatesAutoresizingMaskIntoConstraints = false
    shutter.accessibilityLabel = "Capture"
    shutter.addTarget(self, action: #selector(captureTapped), for: .touchUpInside)
    view.addSubview(shutter)

    NSLayoutConstraint.activate([
      cancel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
      cancel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      hint.topAnchor.constraint(equalTo: cancel.bottomAnchor, constant: 12),
      hint.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      hint.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      shutter.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      shutter.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
      shutter.widthAnchor.constraint(equalToConstant: 70),
      shutter.heightAnchor.constraint(equalToConstant: 70),
      doneButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
      doneButton.centerYAnchor.constraint(equalTo: shutter.centerYAnchor),
    ])
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    let configuration = ARWorldTrackingConfiguration()
    configuration.frameSemantics = .sceneDepth
    sceneView.session.run(configuration)
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    sceneView.session.pause()
  }

  override var prefersStatusBarHidden: Bool { true }

  @objc private func cancelTapped() {
    finish(.failure(ScanError.canceled))
  }

  @objc private func captureTapped() {
    guard let frame = sceneView.session.currentFrame, let depth = frame.sceneDepth else {
      hint.text = ScanError.noDepth.errorDescription
      return
    }
    do {
      let payload = try ScanViewController.payload(frame: frame, depth: depth)
      if multi {
        shots.append(payload)
        doneButton.isHidden = false
        if shots.count >= ScanViewController.maxShots {
          finish(.success(["shots": shots]))
        } else {
          hint.text = "Shot \(shots.count) saved. Move up so the next view overlaps it by about a third, tap the button again, and tap Done after the top."
        }
      } else {
        finish(.success(payload))
      }
    } catch {
      hint.text = error.localizedDescription
    }
  }

  @objc private func doneTapped() {
    if shots.isEmpty {
      finish(.failure(ScanError.canceled))
    } else {
      finish(.success(["shots": shots]))
    }
  }

  private func finish(_ result: Result<[String: Any], Error>) {
    if finished { return }
    finished = true
    dismiss(animated: true) { [onFinish] in
      onFinish?(result)
    }
  }

  /// Builds what JavaScript needs from one ARKit frame.
  private static func payload(frame: ARFrame, depth: ARDepthData) throws -> [String: Any] {
    // Photo: the sensor image is landscape; turn it into a portrait JPEG with the pixels actually rotated.
    let ciImage = CIImage(cvPixelBuffer: frame.capturedImage)
    guard let cgImage = CIContext().createCGImage(ciImage, from: ciImage.extent) else { throw ScanError.encoding }
    let landscape = UIImage(cgImage: cgImage, scale: 1, orientation: .right)
    let portraitSize = CGSize(width: cgImage.height, height: cgImage.width)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let portrait = UIGraphicsImageRenderer(size: portraitSize, format: format).image { _ in
      landscape.draw(in: CGRect(origin: .zero, size: portraitSize))
    }
    guard let jpeg = portrait.jpegData(compressionQuality: 0.9) else { throw ScanError.encoding }
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("wall-\(UUID().uuidString).jpg")
    try jpeg.write(to: url)

    // Depth (meters, sensor orientation) and its confidence.
    let depthBuffer = depth.depthMap
    let depthWidth = CVPixelBufferGetWidth(depthBuffer)
    let depthHeight = CVPixelBufferGetHeight(depthBuffer)
    let depthData = try copyPlane(depthBuffer, width: depthWidth, height: depthHeight, as: Float32.self)
    var confidenceData = Data()
    if let confidence = depth.confidenceMap {
      confidenceData = try copyPlane(confidence, width: CVPixelBufferGetWidth(confidence), height: CVPixelBufferGetHeight(confidence), as: UInt8.self)
    }

    let intrinsics = frame.camera.intrinsics
    let t = frame.camera.transform
    let transform: [Double] = [
      t.columns.0, t.columns.1, t.columns.2, t.columns.3,
    ].flatMap { column in [Double(column.x), Double(column.y), Double(column.z), Double(column.w)] }

    return [
      "uri": url.absoluteString,
      "width": Int(portraitSize.width),
      "height": Int(portraitSize.height),
      "depth": depthData.base64EncodedString(),
      "confidence": confidenceData.base64EncodedString(),
      "depthWidth": depthWidth,
      "depthHeight": depthHeight,
      "fx": Double(intrinsics[0][0]),
      "fy": Double(intrinsics[1][1]),
      "cx": Double(intrinsics[2][0]),
      "cy": Double(intrinsics[2][1]),
      "imageWidth": cgImage.width,
      "imageHeight": cgImage.height,
      "transform": transform,
    ]
  }

  /// Copies a single-plane pixel buffer into tightly packed bytes (rows can have padding).
  private static func copyPlane<T>(_ buffer: CVPixelBuffer, width: Int, height: Int, as type: T.Type) throws -> Data {
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { throw ScanError.encoding }
    let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
    let tight = width * MemoryLayout<T>.size
    var data = Data(capacity: tight * height)
    for y in 0..<height {
      data.append(Data(bytes: base.advanced(by: y * rowBytes), count: tight))
    }
    return data
  }
}
