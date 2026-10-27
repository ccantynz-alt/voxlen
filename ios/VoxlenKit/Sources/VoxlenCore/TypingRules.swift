import Foundation

/// Mirrors UITextAutocapitalizationType without importing UIKit.
public enum AutoCapitalization: Sendable {
    case none, words, sentences, allCharacters
}

/// The small rules that make typing feel like the system keyboard.
public enum TypingRules {
    /// Whether the next letter typed should be uppercase.
    public static func shouldCapitalize(before: String?, mode: AutoCapitalization) -> Bool {
        switch mode {
        case .none:
            return false
        case .allCharacters:
            return true
        case .words:
            guard let last = before?.last else { return true }
            return last.isWhitespace
        case .sentences:
            guard let before, let last = before.last else { return true }
            if last.isNewline { return true }
            guard last.isWhitespace else { return false }
            guard let end = before.last(where: { !$0.isWhitespace }) else { return true }
            return end == "." || end == "!" || end == "?"
        }
    }

    /// True when a space typed now should become ". " instead: the text ends
    /// in one space after a word, as when the system keyboard's double-space
    /// shortcut fires.
    public static func doubleSpaceMakesPeriod(before: String?) -> Bool {
        guard let before, before.hasSuffix(" ") else { return false }
        let rest = before.dropLast()
        guard let previous = rest.last, !previous.isWhitespace else { return false }
        return previous.isLetter || previous.isNumber || ")\"'”’".contains(previous)
    }
}

public enum KeyboardPage: Sendable, Equatable {
    case letters, numbers, symbols
}

public enum KeyKind: Equatable, Sendable {
    case character(String)
    case shift
    case delete
    case page(KeyboardPage)
    case globe
    case space
    case returnKey
}

public enum KeyboardLayout {
    /// The keys of each row, top to bottom. The globe key is included; the
    /// keyboard drops it when the system already shows one.
    public static func rows(for page: KeyboardPage) -> [[KeyKind]] {
        func chars(_ s: String) -> [KeyKind] { s.map { .character(String($0)) } }
        let bottom: (KeyboardPage) -> [KeyKind] = { [.page($0), .globe, .space, .returnKey] }
        switch page {
        case .letters:
            return [
                chars("qwertyuiop"),
                chars("asdfghjkl"),
                [.shift] + chars("zxcvbnm") + [.delete],
                bottom(.numbers),
            ]
        case .numbers:
            return [
                chars("1234567890"),
                chars("-/:;()$&@\""),
                [.page(.symbols)] + chars(".,?!'") + [.delete],
                bottom(.letters),
            ]
        case .symbols:
            return [
                chars("[]{}#%^*+="),
                chars("_\\|~<>€£¥•"),
                [.page(.numbers)] + chars(".,?!'") + [.delete],
                bottom(.letters),
            ]
        }
    }
}
