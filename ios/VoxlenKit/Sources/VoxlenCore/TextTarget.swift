import Foundation

/// What the Fix button works on: the user's selection, or else the sentence
/// that ends at the cursor. A keyboard only sees the text the host app
/// exposes around the cursor, so it never assumes it has the whole document.
public enum FixTarget: Equatable, Sendable {
    /// Selected text; replaced wholesale, since inserting replaces a selection.
    case selection(String)
    /// The sentence before the cursor, and the whitespace between it and the cursor.
    case sentence(text: String, trailing: String)

    public var text: String {
        switch self {
        case .selection(let text), .sentence(let text, _): text
        }
    }
}

/// How to turn the target into the corrected text with the fewest keystrokes.
/// Only the part from the first changed character to the cursor is retyped:
/// the rest of the sentence, and any formatting the host app holds on it, is
/// left alone.
public struct ReplacementPlan: Equatable, Sendable {
    /// What the text before the cursor must end with for the plan to be safe.
    /// If the user typed or moved the cursor meanwhile, it won't, and the
    /// keyboard must not delete anything.
    public let requiredSuffix: String
    public let deleteCount: Int
    public let insert: String
    /// For a selection, `insert` replaces the selection and `deleteCount` is 0.
    public let replacesSelection: Bool

    /// The plan that puts the original back, valid right after this one ran.
    public let undo: UndoPlan
}

public struct UndoPlan: Equatable, Sendable {
    public let requiredSuffix: String
    public let deleteCount: Int
    public let insert: String
}

public enum TextTargeting {
    /// Words that end in a period without ending the sentence ("Smith v. Jones").
    static let abbreviations: Set<String> = [
        "mr", "mrs", "ms", "mx", "dr", "prof", "sr", "jr", "st", "hon", "rt",
        "v", "vs", "no", "nos", "s", "ss", "art", "arts", "para", "paras", "cl", "sch", "reg", "regs", "pt",
        "ch", "sec", "secs", "p", "pp", "fig", "vol", "ed", "eds", "ibid", "id", "cf", "eg", "ie", "etc", "al",
        "co", "corp", "inc", "ltd", "pty", "plc", "llp", "llc", "bros", "dept", "est", "approx", "jan", "feb",
        "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "j", "cj", "lj", "jj",
    ]

    /// Picks what to fix. Returns nil when there is nothing to fix.
    public static func target(before: String?, selected: String?) -> FixTarget? {
        if let selected, !selected.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return .selection(selected)
        }
        guard let before, !before.isEmpty else { return nil }

        var bodyEnd = before.endIndex
        while bodyEnd > before.startIndex, before[before.index(before: bodyEnd)].isWhitespace {
            bodyEnd = before.index(before: bodyEnd)
        }
        guard bodyEnd > before.startIndex else { return nil }
        let trailing = String(before[bodyEnd...])

        var start = before.startIndex
        var i = before.index(before: bodyEnd)
        // Walk back from the character before the sentence's own end mark.
        while i > before.startIndex {
            let previous = before.index(before: i)
            if endsSentence(before, at: previous, followedBy: i) {
                start = i
                break
            }
            i = previous
        }
        while start < bodyEnd, before[start].isWhitespace {
            start = before.index(after: start)
        }
        let sentence = String(before[start..<bodyEnd])
        guard !sentence.isEmpty else { return nil }
        return .sentence(text: sentence, trailing: trailing)
    }

    /// True when the character at `index` ends a sentence, given the character after it.
    static func endsSentence(_ s: String, at index: String.Index, followedBy next: String.Index) -> Bool {
        let c = s[index]
        if c.isNewline { return true }
        guard c == "." || c == "!" || c == "?" || c == "…", s[next].isWhitespace else { return false }
        guard c == "." else { return true }
        // A period after a known abbreviation or a single capital initial does not end it.
        var wordStart = index
        while wordStart > s.startIndex, s[s.index(before: wordStart)].isLetter || s[s.index(before: wordStart)] == "." {
            wordStart = s.index(before: wordStart)
        }
        let word = s[wordStart..<index].replacingOccurrences(of: ".", with: "").lowercased()
        if abbreviations.contains(word) { return false }
        if word.count == 1, s[wordStart].isUppercase { return false }
        return true
    }

    /// The edit sequence that turns `target` into `corrected`, or nil when nothing changes.
    public static func plan(for target: FixTarget, corrected: String) -> ReplacementPlan? {
        guard corrected != target.text else { return nil }
        switch target {
        case .selection(let original):
            return ReplacementPlan(
                requiredSuffix: "",
                deleteCount: 0,
                insert: corrected,
                replacesSelection: true,
                // After inserting over a selection the corrected text sits
                // before the cursor, unselected.
                undo: UndoPlan(requiredSuffix: corrected, deleteCount: corrected.count, insert: original)
            )
        case .sentence(let original, let trailing):
            let shared = commonPrefixLength(original, corrected)
            let originalTail = String(original.dropFirst(shared))
            let correctedTail = String(corrected.dropFirst(shared))
            return ReplacementPlan(
                requiredSuffix: original + trailing,
                deleteCount: originalTail.count + trailing.count,
                insert: correctedTail + trailing,
                replacesSelection: false,
                undo: UndoPlan(
                    requiredSuffix: corrected + trailing,
                    deleteCount: correctedTail.count + trailing.count,
                    insert: originalTail + trailing
                )
            )
        }
    }

    static func commonPrefixLength(_ a: String, _ b: String) -> Int {
        var count = 0
        for (x, y) in zip(a, b) {
            guard x == y else { break }
            count += 1
        }
        return count
    }
}
