import CoreML
import Foundation
import UIKit

enum SegError: Error {
  case missing
  case image
  case model
}

/// Cuts objects out of a photo with MobileSAM ("segment anything", Apache 2.0) running on the phone through Core ML.
/// The photo goes through the image encoder once; after that each point is a quick decoder call that returns the
/// outline of the object under it. Nothing leaves the phone.
final class HoldSegmenter {
  static let shared = HoldSegmenter()

  private let lock = NSLock()
  private var encoder: MLModel?
  private var decoder: MLModel?
  private var cachedURI: String?
  private var embedding: MLMultiArray?
  private var validW = 0
  private var validH = 0

  /// The folder with the model files; the same code works however the pod's resources end up packaged.
  static func modelsBundle() -> Bundle? {
    let candidates = [Bundle.main, Bundle(for: HoldSegmenter.self)]
    for bundle in candidates {
      if let url = bundle.url(forResource: "WallDepthModels", withExtension: "bundle"), let inner = Bundle(url: url) {
        return inner
      }
    }
    return nil
  }

  static func isAvailable() -> Bool {
    return modelsBundle()?.url(forResource: "encoder", withExtension: "bin") != nil
  }

  /// Unpacks a model file into a Core ML package, compiles it once and keeps the compiled copy for next time.
  private func loadModel(_ name: String) throws -> MLModel {
    let fm = FileManager.default
    let support = try fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("WallDepthModels", isDirectory: true)
    try fm.createDirectory(at: support, withIntermediateDirectories: true)
    let compiled = support.appendingPathComponent("\(name)-v1.mlmodelc", isDirectory: true)
    let config = MLModelConfiguration()
    config.computeUnits = .all
    if fm.fileExists(atPath: compiled.path), let cached = try? MLModel(contentsOf: compiled, configuration: config) {
      return cached
    }
    guard let bundle = HoldSegmenter.modelsBundle(), let binURL = bundle.url(forResource: name, withExtension: "bin") else {
      throw SegError.missing
    }
    let data = try Data(contentsOf: binURL, options: .mappedIfSafe)
    let headerLength = Int(data[0]) | (Int(data[1]) << 8) | (Int(data[2]) << 16) | (Int(data[3]) << 24)
    let headerData = data.subdata(in: 4..<(4 + headerLength))
    guard let entries = try JSONSerialization.jsonObject(with: headerData) as? [[String: Any]] else { throw SegError.model }
    let base = 4 + headerLength
    let package = fm.temporaryDirectory.appendingPathComponent("\(name).mlpackage", isDirectory: true)
    try? fm.removeItem(at: package)
    for entry in entries {
      guard let path = entry["path"] as? String, let offset = entry["offset"] as? Int, let size = entry["size"] as? Int else {
        throw SegError.model
      }
      let destination = package.appendingPathComponent(path)
      try fm.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
      try data.subdata(in: (base + offset)..<(base + offset + size)).write(to: destination)
    }
    let built = try MLModel.compileModel(at: package)
    try? fm.removeItem(at: compiled)
    do {
      try fm.moveItem(at: built, to: compiled)
    } catch {
      try fm.copyItem(at: built, to: compiled)
    }
    try? fm.removeItem(at: package)
    return try MLModel(contentsOf: compiled, configuration: config)
  }

  /// Runs the image encoder for this photo (skipped when it is the photo from the last call).
  private func prepare(uri: String) throws {
    if cachedURI == uri, embedding != nil { return }
    if encoder == nil { encoder = try loadModel("encoder") }
    if decoder == nil { decoder = try loadModel("decoder") }
    guard let encoder = encoder else { throw SegError.model }
    guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
      throw SegError.image
    }

    // Longest side to 1024 pixels, upright, then into the 1024 square (padded with zeros at the right and bottom).
    let longest = max(image.size.width, image.size.height)
    let scale = 1024 / longest
    let width = max(1, Int((image.size.width * scale).rounded()))
    let height = max(1, Int((image.size.height * scale).rounded()))
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let drawn = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format).image { _ in
      image.draw(in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    guard let cgImage = drawn.cgImage else { throw SegError.image }
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let drewIt: Bool = pixels.withUnsafeMutableBytes { raw -> Bool in
      guard let context = CGContext(
        data: raw.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ) else { return false }
      context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    if !drewIt { throw SegError.image }

    let input = try MLMultiArray(shape: [1, 3, 1024, 1024], dataType: .float32)
    let plane = 1024 * 1024
    let out = input.dataPointer.assumingMemoryBound(to: Float32.self)
    out.initialize(repeating: 0, count: 3 * plane)
    for y in 0..<height {
      for x in 0..<width {
        let i = (y * width + x) * 4
        let o = y * 1024 + x
        out[o] = (Float(pixels[i]) - 123.675) / 58.395
        out[plane + o] = (Float(pixels[i + 1]) - 116.28) / 57.12
        out[2 * plane + o] = (Float(pixels[i + 2]) - 103.53) / 57.375
      }
    }
    let result = try encoder.prediction(from: MLDictionaryFeatureProvider(dictionary: ["image": MLFeatureValue(multiArray: input)]))
    guard let embeddingValue = result.featureValue(for: "embedding")?.multiArrayValue else { throw SegError.model }
    embedding = embeddingValue
    validW = width
    validH = height
    cachedURI = uri
  }

  private static func halfToFloat(_ h: UInt16) -> Float {
    let sign: Float = (h >> 15) & 1 == 1 ? -1 : 1
    let exponent = Int((h >> 10) & 0x1f)
    let mantissa = Float(h & 0x3ff)
    if exponent == 0 { return sign * mantissa * Float(sign: .plus, exponent: -24, significand: 1) }
    if exponent == 31 { return mantissa == 0 ? sign * Float.infinity : Float.nan }
    return sign * (1 + mantissa / 1024) * Float(sign: .plus, exponent: exponent - 15, significand: 1)
  }

  /// A reader for the numbers in a model output, whichever precision Core ML chose.
  private static func reader(_ array: MLMultiArray) -> (Int) -> Float {
    switch array.dataType {
    case .float32:
      let p = array.dataPointer.assumingMemoryBound(to: Float32.self)
      return { p[$0] }
    case .float16:
      let p = array.dataPointer.assumingMemoryBound(to: UInt16.self)
      return { HoldSegmenter.halfToFloat(p[$0]) }
    case .double:
      let p = array.dataPointer.assumingMemoryBound(to: Double.self)
      return { Float(p[$0]) }
    default:
      return { Float(truncating: array[$0]) }
    }
  }

  /// The object under one point (x, y in 0...1 across the photo): its box, how sure the model is, and a 48x48 mask.
  private func segment(x: Double, y: Double) throws -> [String: Any] {
    guard let decoder = decoder, let embedding = embedding else { throw SegError.model }
    let points = try MLMultiArray(shape: [1, 1, 2], dataType: .float32)
    points[0] = NSNumber(value: Float(x * Double(validW)))
    points[1] = NSNumber(value: Float(y * Double(validH)))
    let labels = try MLMultiArray(shape: [1, 1], dataType: .float32)
    labels[0] = NSNumber(value: Float(1))
    let result = try decoder.prediction(from: MLDictionaryFeatureProvider(dictionary: [
      "embedding": MLFeatureValue(multiArray: embedding),
      "points": MLFeatureValue(multiArray: points),
      "labels": MLFeatureValue(multiArray: labels),
    ]))
    guard let masks = result.featureValue(for: "masks")?.multiArrayValue,
          let iouArray = result.featureValue(for: "iou")?.multiArrayValue else { throw SegError.model }

    let strides = masks.strides.map { $0.intValue }
    let rowStride = strides[strides.count - 2]
    let colStride = strides[strides.count - 1]
    let read = HoldSegmenter.reader(masks)
    // The mask covers the 1024 square at a quarter of the resolution; the photo fills the top-left part of it.
    let lowW = Double(validW) / 4
    let lowH = Double(validH) / 4
    let cols = min(256, Int(lowW.rounded(.up)))
    let rows = min(256, Int(lowH.rounded(.up)))
    var minX = cols, maxX = -1, minY = rows, maxY = -1
    var count = 0
    for r in 0..<rows {
      for c in 0..<cols where read(r * rowStride + c * colStride) > 0 {
        count += 1
        if c < minX { minX = c }
        if c > maxX { maxX = c }
        if r < minY { minY = r }
        if r > maxY { maxY = r }
      }
    }
    if count == 0 { return [:] }
    let gridSize = 48
    let boxW = maxX - minX + 1
    let boxH = maxY - minY + 1
    var grid = Data(count: gridSize * gridSize)
    for gy in 0..<gridSize {
      for gx in 0..<gridSize {
        let c = min(maxX, minX + Int((Double(gx) + 0.5) / Double(gridSize) * Double(boxW)))
        let r = min(maxY, minY + Int((Double(gy) + 0.5) / Double(gridSize) * Double(boxH)))
        if read(r * rowStride + c * colStride) > 0 { grid[gy * gridSize + gx] = 1 }
      }
    }
    let iou = HoldSegmenter.reader(iouArray)(0)
    return [
      "x0": Double(minX) / lowW,
      "y0": Double(minY) / lowH,
      "x1": Double(maxX + 1) / lowW,
      "y1": Double(maxY + 1) / lowH,
      "area": Double(count) / (lowW * lowH),
      "iou": Double(iou),
      "gw": gridSize,
      "gh": gridSize,
      "grid": grid.base64EncodedString(),
    ]
  }

  /// Cuts out the object under each point. An empty entry means nothing was found there.
  func run(uri: String, points: [[Double]]) throws -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    try prepare(uri: uri)
    var results: [[String: Any]] = []
    for p in points {
      if p.count < 2 {
        results.append([:])
        continue
      }
      results.append((try? segment(x: p[0], y: p[1])) ?? [:])
    }
    return results
  }

  /// A plain-text account of every step, for finding out why the model does not work on a particular phone.
  func report(uri: String) -> String {
    lock.lock()
    defer { lock.unlock() }
    var lines: [String] = []
    let bundle = HoldSegmenter.modelsBundle()
    lines.append("bundle: \(bundle != nil ? "found" : "MISSING")")
    lines.append("encoder file: \(bundle?.url(forResource: "encoder", withExtension: "bin") != nil ? "found" : "MISSING")")
    lines.append("decoder file: \(bundle?.url(forResource: "decoder", withExtension: "bin") != nil ? "found" : "MISSING")")
    do {
      cachedURI = nil
      let started = Date()
      try prepare(uri: uri)
      lines.append("encoder ran in \(String(format: "%.1f", Date().timeIntervalSince(started))) s, photo \(validW)x\(validH)")
      if let embedding = embedding {
        let strides = embedding.strides.map { $0.intValue }
        let shape = embedding.shape.map { $0.intValue }
        lines.append("embedding shape \(shape) strides \(strides) type \(embedding.dataType.rawValue)")
        if shape.count == 4, strides.count == 4 {
          let read = HoldSegmenter.reader(embedding)
          var sum = 0.0, sumSquares = 0.0, low = Float.infinity, high = -Float.infinity
          var bad = 0
          var n = 0
          for c in 0..<shape[1] {
            for y in 0..<shape[2] {
              for x in 0..<shape[3] {
                let v = read(c * strides[1] + y * strides[2] + x * strides[3])
                if v.isNaN || v.isInfinite { bad += 1; continue }
                sum += Double(v)
                sumSquares += Double(v) * Double(v)
                if v < low { low = v }
                if v > high { high = v }
                n += 1
              }
            }
          }
          let mean = n > 0 ? sum / Double(n) : 0
          let sd = n > 0 ? (sumSquares / Double(n) - mean * mean).squareRoot() : 0
          lines.append("embedding mean \(String(format: "%.4f", mean)) sd \(String(format: "%.4f", sd)) min \(low) max \(high) bad \(bad)")
        }
      }
      let cut = try segment(x: 0.5, y: 0.5)
      if cut.isEmpty {
        lines.append("decoder ran, nothing found at the center")
      } else {
        lines.append("decoder ran: iou \(cut["iou"] ?? "?") area \(cut["area"] ?? "?")")
      }
    } catch {
      lines.append("FAILED: \(error) / \(error.localizedDescription)")
    }
    return lines.joined(separator: "\n")
  }
}
