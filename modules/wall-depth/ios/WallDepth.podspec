Pod::Spec.new do |s|
  s.name           = 'WallDepth'
  s.version        = '1.0.0'
  s.summary        = 'LiDAR wall capture for Belay Buddy Route AI'
  s.description    = 'Opens an ARKit camera, captures a photo with its LiDAR depth map and returns both to JavaScript.'
  s.license        = { :type => 'MIT' }
  s.author         = 'Belay Buddy'
  s.homepage       = 'https://belaybuddy.app'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/fizzgig17/belaybuddy.app.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  # The segmentation models are packed as plain files (a Core ML package is a folder, which Xcode would treat specially).
  s.resource_bundles = { 'WallDepthModels' => ['models/*.bin'] }
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
