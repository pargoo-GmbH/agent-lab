import Foundation
import Security
import AppKit
import UniformTypeIdentifiers

enum HelperFailure: Error { case invalid, keychain, cancelled }
let service = "com.pargoo.strapi-editor"

func emit(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value), let text = String(data: data, encoding: .utf8) {
        print(text)
    }
}

do {
    let data = FileHandle.standardInput.readDataToEndOfFile()
    guard data.count <= 65536,
          let request = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          let action = request["action"] as? String else { throw HelperFailure.invalid }
    if action == "chooseFile" {
        NSApplication.shared.setActivationPolicy(.accessory)
        let panel = NSOpenPanel()
        panel.title = "Choose an image for pargoo"
        panel.message = "Select the original image to upload to the confirmed Strapi connection."
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.jpeg, .png, UTType(filenameExtension: "webp") ?? .image]
        NSApplication.shared.activate(ignoringOtherApps: true)
        guard panel.runModal() == .OK, let url = panel.url else { throw HelperFailure.cancelled }
        emit(["ok": true, "path": url.path, "name": url.lastPathComponent])
    } else {
        guard let key = request["key"] as? String,
              key.range(of: "^[a-f0-9-]{36}:[a-f0-9-]{36}$", options: .regularExpression) != nil else { throw HelperFailure.invalid }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        switch action {
        case "set":
            guard let value = request["value"] as? String, !value.isEmpty, value.utf8.count <= 16384 else { throw HelperFailure.invalid }
            let attributes: [String: Any] = [kSecValueData as String: Data(value.utf8)]
            let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
            if status == errSecItemNotFound {
                var item = query
                item[kSecValueData as String] = Data(value.utf8)
                item[kSecAttrLabel as String] = "pargoo connection"
                guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw HelperFailure.keychain }
            } else if status != errSecSuccess { throw HelperFailure.keychain }
            emit(["ok": true])
        case "get":
            var item = query
            item[kSecReturnData as String] = true
            item[kSecMatchLimit as String] = kSecMatchLimitOne
            var result: CFTypeRef?
            guard SecItemCopyMatching(item as CFDictionary, &result) == errSecSuccess,
                  let resultData = result as? Data,
                  let value = String(data: resultData, encoding: .utf8) else { throw HelperFailure.keychain }
            // Private IPC response, consumed inside the plugin runtime; never a model-facing tool result.
            emit(["ok": true, "value": value])
        case "delete":
            let status = SecItemDelete(query as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { throw HelperFailure.keychain }
            emit(["ok": true])
        default: throw HelperFailure.invalid
        }
    }
} catch HelperFailure.cancelled {
    emit(["ok": false, "code": "CANCELLED"])
} catch {
    emit(["ok": false, "code": "NATIVE_HELPER_ERROR"])
    exit(1)
}
