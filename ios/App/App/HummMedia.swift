import Capacitor
import AVFoundation
import PhotosUI
import UniformTypeIdentifiers

/// System pickers and a time-limited PCM reader keep compressed imports out of Web Audio's full decode.
@objc(HummMediaPlugin)
public class HummMediaPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate, PHPickerViewControllerDelegate {
    public let identifier = "HummMediaPlugin"
    public let jsName = "HummMedia"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelPick", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "decodeMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelDecode", returnType: CAPPluginReturnPromise),
    ]
    private var pickCall: CAPPluginCall?
    private weak var picker: UIViewController?
    private let queue = DispatchQueue(label: "humm.media", qos: .userInitiated)
    private let lock = NSLock()
    private var readers: [String: AVAssetReader] = [:]
    private var cancelled = Set<String>()
    private var backgroundObserver: NSObjectProtocol?
    private var root: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("humm-imports", isDirectory: true)
    }

    public override func load() {
        backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self else { return }
            self.lock.lock()
            for reader in self.readers.values { reader.cancelReading() }
            self.lock.unlock()
        }
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        // Failed/interrupted imports are temporary and never become songs on their own.
        for url in (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.contentModificationDateKey])) ?? [] {
            if let date = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate,
               Date().timeIntervalSince(date) > 86400 { try? FileManager.default.removeItem(at: url) }
        }
    }
    private func directory(_ id: String) throws -> URL {
        guard UUID(uuidString: id) != nil else { throw NSError(domain: "HUMM", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid import"]) }
        return root.appendingPathComponent(id, isDirectory: true)
    }
    @objc func pickMedia(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pickCall == nil, let controller = self.bridge?.viewController else { call.reject("A picker is already open"); return }
            self.pickCall = call
            if call.getString("kind") == "video" {
                var config = PHPickerConfiguration()
                config.filter = .videos
                config.selectionLimit = 1
                let picker = PHPickerViewController(configuration: config)
                picker.delegate = self
                self.picker = picker
                controller.present(picker, animated: true)
            } else {
                let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.audio], asCopy: true)
                picker.delegate = self
                self.picker = picker
                controller.present(picker, animated: true)
            }
        }
    }
    private func finish(_ result: [String: Any]? = nil, error: Error? = nil, expected: CAPPluginCall? = nil) {
        DispatchQueue.main.async {
            if let expected = expected, self.pickCall !== expected {
                if let id = result?["nativeId"] as? String, let folder = try? self.directory(id) { try? FileManager.default.removeItem(at: folder) }
                return
            }
            let call = self.pickCall
            self.pickCall = nil
            self.picker = nil
            if let error = error { call?.reject(error.localizedDescription) }
            else { call?.resolve(result ?? ["cancelled": true]) }
        }
    }
    private func copySelection(_ url: URL, expected: CAPPluginCall?) {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size <= 256 * 1024 * 1024 else { throw NSError(domain: "HUMM", code: 2, userInfo: [NSLocalizedDescriptionKey: "Choose a file smaller than 256 MB."]) }
            let id = UUID().uuidString
            let folder = try directory(id)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let ext = url.pathExtension.filter { $0.isLetter || $0.isNumber }.prefix(8)
            let dest = folder.appendingPathComponent("source.\(ext.isEmpty ? "media" : String(ext))")
            do {
                try FileManager.default.copyItem(at: url, to: dest)
                try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: dest.path)
            } catch { try? FileManager.default.removeItem(at: folder); throw error }
            finish(["nativeId": id, "name": url.lastPathComponent], expected: expected)
        } catch { finish(error: error, expected: expected) }
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard picker === controller else { return }
        guard let url = urls.first else { finish(); return }
        let expected = pickCall
        queue.async { self.copySelection(url, expected: expected) }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { if picker === controller { finish(expected: pickCall) } }
    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        guard self.picker === picker else { return }
        picker.dismiss(animated: true)
        guard let item = results.first?.itemProvider else { finish(); return }
        let expected = pickCall
        item.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, error in
            if let url = url { self.copySelection(url, expected: expected) } else { self.finish(error: error, expected: expected) }
        }
    }
    @objc func cancelPick(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.picker?.dismiss(animated: true); self.finish(); call.resolve() }
    }
    @objc func cancelDecode(_ call: CAPPluginCall) {
        lock.lock()
        if let id = call.getString("id"), UUID(uuidString: id) != nil { cancelled.insert(id); readers[id]?.cancelReading() }
        lock.unlock()
        call.resolve()
    }
    @objc func removeMedia(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let folder = try? directory(id) else { call.reject("Invalid import"); return }
        lock.lock(); cancelled.remove(id); lock.unlock()
        do {
            if FileManager.default.fileExists(atPath: folder.path) { try FileManager.default.removeItem(at: folder) }
            call.resolve()
        } catch { call.reject("Could not remove temporary import") }
    }
    @objc func decodeMedia(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let folder = try? directory(id) else { call.reject("Invalid import"); return }
        let seconds = min(180, max(1, call.getDouble("seconds") ?? 60))
        queue.async {
            do {
                guard let source = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil).first(where: { $0.lastPathComponent.hasPrefix("source.") }) else { throw NSError(domain: "HUMM", code: 3) }
                let asset = AVURLAsset(url: source)
                guard let track = asset.tracks(withMediaType: .audio).first else { throw NSError(domain: "HUMM", code: 4, userInfo: [NSLocalizedDescriptionKey: "This file has no audio."]) }
                let duration = CMTimeGetSeconds(asset.duration)
                guard duration.isFinite, duration > 0 else { throw NSError(domain: "HUMM", code: 5, userInfo: [NSLocalizedDescriptionKey: "Cannot read this recording's duration."]) }
                let reader = try AVAssetReader(asset: asset)
                reader.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: min(seconds, duration), preferredTimescale: 600))
                let output = AVAssetReaderAudioMixOutput(audioTracks: [track], audioSettings: [
                    AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 1,
                    AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true,
                    AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false,
                ])
                output.alwaysCopiesSampleData = false
                guard reader.canAdd(output) else { throw NSError(domain: "HUMM", code: 6) }
                reader.add(output)
                self.lock.lock(); self.readers[id] = reader; let wasCancelled = self.cancelled.contains(id); self.lock.unlock()
                defer { self.lock.lock(); self.readers.removeValue(forKey: id); self.cancelled.remove(id); self.lock.unlock() }
                guard !wasCancelled else { throw NSError(domain: "HUMM", code: 9, userInfo: [NSLocalizedDescriptionKey: "Import cancelled"]) }
                guard reader.startReading() else { throw reader.error ?? NSError(domain: "HUMM", code: 7) }
                let pcm = folder.appendingPathComponent("audio.pcm")
                FileManager.default.createFile(atPath: pcm.path, contents: nil, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
                let file = try FileHandle(forWritingTo: pcm)
                defer { try? file.close() }
                let limit = Int(seconds * 48000) * 4
                let deadline = Date().addingTimeInterval(90)
                var written = 0
                while reader.status == .reading {
                    if Date() > deadline { reader.cancelReading(); break }
                    let data: Data? = try autoreleasepool {
                        guard let sample = output.copyNextSampleBuffer(), let block = CMSampleBufferGetDataBuffer(sample) else { return nil }
                        let count = min(CMBlockBufferGetDataLength(block), limit - written)
                        guard count > 0 else { return nil }
                        var data = Data(count: count)
                        let status = data.withUnsafeMutableBytes { bytes in
                            CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: count, destination: bytes.baseAddress!)
                        }
                        guard status == kCMBlockBufferNoErr else { throw NSError(domain: "HUMM", code: 8) }
                        return data
                    }
                    guard let data = data, !data.isEmpty else { break }
                    try file.write(contentsOf: data)
                    written += data.count
                    if written >= limit { break }
                }
                guard reader.status != .failed, reader.status != .cancelled, written > 0 else { throw reader.error ?? NSError(domain: "HUMM", code: 9, userInfo: [NSLocalizedDescriptionKey: "Import was interrupted. Please try again."]) }
                reader.cancelReading()
                try file.close()
                call.resolve(["url": pcm.absoluteString, "sampleRate": 48000, "seconds": duration])
            } catch {
                try? FileManager.default.removeItem(at: folder)
                call.reject("Could not open recording: \(error.localizedDescription)")
            }
        }
    }
}
