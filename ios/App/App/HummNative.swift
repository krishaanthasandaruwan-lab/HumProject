import UIKit
import Capacitor
import Security

/// Native appearance and a device-only Keychain store. The first release has no Apple sign-in.
@objc(HummNativePlugin)
public class HummNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HummNativePlugin"
    public let jsName = "HummNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAppearance", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "textScale", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keychainGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keychainSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keychainRemove", returnType: CAPPluginReturnPromise),
    ]
    private var textObserver: NSObjectProtocol?
    public override func load() {
        textObserver = NotificationCenter.default.addObserver(forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
            self?.bridge?.triggerJSEvent(eventName: "humm:text-scale", target: "window")
        }
    }
    @objc func textScale(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["scale": UIFontMetrics(forTextStyle: .body).scaledValue(for: 16) / 16]) }
    }
    @objc func setAppearance(_ call: CAPPluginCall) {
        guard let theme = call.getString("theme"), ["system", "light", "dark"].contains(theme) else { call.reject("Invalid appearance"); return }
        DispatchQueue.main.async {
            UserDefaults.standard.set(theme, forKey: "humm.theme")
            (self.bridge?.viewController as? MainViewController)?.applyAppearance()
            call.resolve()
        }
    }
    // MARK: Keychain

    private func keyQuery(_ key: String) -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Bundle.main.bundleIdentifier ?? "humm",
            kSecAttrAccount as String: key,
        ]
    }

    @objc func keychainGet(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { return call.reject("No key", "failed") }
        var query = keyQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) {
            call.resolve(["value": value])
        } else if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
        } else {
            call.reject("Keychain read failed (\(status))", "failed")
        }
    }

    @objc func keychainSet(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else { return call.reject("No key or value", "failed") }
        let data = Data(value.utf8)
        let query = keyQuery(key)
        let update: [String: Any] = [kSecValueData as String: data]
        var status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var add = query
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            status = SecItemAdd(add as CFDictionary, nil)
        }
        if status == errSecSuccess { call.resolve() } else { call.reject("Keychain write failed (\(status))", "failed") }
    }

    @objc func keychainRemove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { return call.reject("No key", "failed") }
        let status = SecItemDelete(keyQuery(key) as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound { call.resolve() } else { call.reject("Keychain delete failed (\(status))", "failed") }
    }
}

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HummNativePlugin())
        bridge?.registerPluginInstance(HummMediaPlugin())
        applyAppearance()
    }
    func applyAppearance() {
        let theme = UserDefaults.standard.string(forKey: "humm.theme") ?? "system"
        overrideUserInterfaceStyle = theme == "dark" ? .dark : theme == "light" ? .light : .unspecified
        view.backgroundColor = UIColor(named: "HummBackground")
        webView?.isOpaque = false
        webView?.backgroundColor = .clear
        webView?.scrollView.backgroundColor = .clear
        setNeedsStatusBarAppearanceUpdate()
    }
    override var preferredStatusBarStyle: UIStatusBarStyle {
        traitCollection.userInterfaceStyle == .dark ? .lightContent : .darkContent
    }
}
