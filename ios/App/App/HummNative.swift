import UIKit
import Capacitor
import AuthenticationServices
import Security

/// HUMM's own native bits, for the web code: Sign in with Apple, and a small store in the iPhone's
/// Keychain (kept on this device only, and kept when the app is deleted and installed again).
@objc(HummNativePlugin)
public class HummNativePlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "HummNativePlugin"
    public let jsName = "HummNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appleCredentialState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keychainGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keychainSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keychainRemove", returnType: CAPPluginReturnPromise),
    ]

    private var pendingSignIn: CAPPluginCall?

    // MARK: Sign in with Apple

    @objc func signInWithApple(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.pendingSignIn != nil {
                call.reject("A sign-in is already open", "busy")
                return
            }
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.pendingSignIn = call
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = pendingSignIn else { return }
        pendingSignIn = nil
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call.reject("No Apple ID came back", "failed")
            return
        }
        // Apple shares the name and email only on the very first sign-in; later ones carry just the user id.
        var result: [String: Any] = ["user": credential.user]
        if let email = credential.email { result["email"] = email }
        if let given = credential.fullName?.givenName { result["givenName"] = given }
        if let family = credential.fullName?.familyName { result["familyName"] = family }
        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = pendingSignIn else { return }
        pendingSignIn = nil
        if (error as? ASAuthorizationError)?.code == .canceled {
            call.reject("Cancelled", "cancelled")
        } else {
            call.reject(error.localizedDescription, "failed")
        }
    }

    /// Whether the person is still signed in (they can stop using Sign in with Apple for HUMM in iOS Settings).
    @objc func appleCredentialState(_ call: CAPPluginCall) {
        guard let user = call.getString("user"), !user.isEmpty else {
            call.reject("No user", "failed")
            return
        }
        ASAuthorizationAppleIDProvider().getCredentialState(forUserID: user) { state, _ in
            switch state {
            case .authorized: call.resolve(["state": "authorized"])
            case .revoked: call.resolve(["state": "revoked"])
            case .notFound: call.resolve(["state": "notFound"])
            default: call.resolve(["state": "unknown"])
            }
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

/// The app's web view, with HUMM's own plugin registered next to the Capacitor ones.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HummNativePlugin())
    }
}
