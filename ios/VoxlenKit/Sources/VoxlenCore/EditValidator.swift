import Foundation

/// An edit the model proposed: replace `original` (copied from the text) with `replacement`.
public struct ProposedEdit: Codable, Equatable, Sendable {
    public var original: String
    public var replacement: String
    public var category: String?
    public var reason: String?

    public init(original: String, replacement: String, category: String? = nil, reason: String? = nil) {
        self.original = original
        self.replacement = replacement
        self.category = category
        self.reason = reason
    }
}

public enum EditRejection: String, Codable, Sendable {
    case empty
    case noChange = "no_change"
    case notFound = "not_found"
    case ambiguous
    case changesNumber = "changes_number"
    case touchesProtectedTerm = "touches_protected_term"
    case overlaps
}

public struct AcceptedEdit: Equatable, Sendable {
    public let edit: ProposedEdit
    public let range: Range<String.Index>
}

public struct EditCheck: Sendable {
    public let accepted: [AcceptedEdit]
    public let rejected: [(edit: ProposedEdit, reason: EditRejection)]
    public let corrected: String
    /// Share of the text the accepted edits touch, in UTF-16 units like the server.
    public let changedRatio: Double

    /// Above this, show the change for review instead of applying it.
    public static let rewriteRatio = 0.35
    public var rewriteSuspected: Bool { changedRatio > Self.rewriteRatio }
}

/// The client half of grammar-fix validation. Mirrors `checkEdits` in
/// landing/api/_grammar-fix.ts; both are pinned by
/// shared/grammar-fix/edit-cases.json. The server already validates, but the
/// BYOK path talks to the model directly, and a client should never apply an
/// edit it has not checked against the text it is about to change.
public enum EditValidator {
    public static func check(text: String, edits: [ProposedEdit], protectedTerms: [String]) -> EditCheck {
        var rejected: [(edit: ProposedEdit, reason: EditRejection)] = []
        var candidates: [AcceptedEdit] = []

        let protectedRanges = protectedTerms.flatMap { occurrences(of: $0, in: text) }

        for edit in edits {
            if edit.original.isEmpty {
                rejected.append((edit, .empty))
                continue
            }
            if edit.original == edit.replacement {
                rejected.append((edit, .noChange))
                continue
            }
            let found = occurrences(of: edit.original, in: text)
            guard found.count == 1, let range = found.first else {
                rejected.append((edit, found.isEmpty ? .notFound : .ambiguous))
                continue
            }
            if digits(edit.original) != digits(edit.replacement) {
                rejected.append((edit, .changesNumber))
                continue
            }
            if protectedRanges.contains(where: { $0.overlaps(range) }) {
                rejected.append((edit, .touchesProtectedTerm))
                continue
            }
            candidates.append(AcceptedEdit(edit: edit, range: range))
        }

        candidates.sort { $0.range.lowerBound < $1.range.lowerBound }
        var accepted: [AcceptedEdit] = []
        for candidate in candidates {
            if let previous = accepted.last, candidate.range.lowerBound < previous.range.upperBound {
                rejected.append((candidate.edit, .overlaps))
                continue
            }
            accepted.append(candidate)
        }

        var corrected = ""
        var cursor = text.startIndex
        var changed = 0
        for item in accepted {
            corrected += text[cursor..<item.range.lowerBound]
            corrected += item.edit.replacement
            cursor = item.range.upperBound
            changed += max(item.edit.original.utf16.count, item.edit.replacement.utf16.count)
        }
        corrected += text[cursor...]

        let length = text.utf16.count
        return EditCheck(
            accepted: accepted,
            rejected: rejected,
            corrected: corrected,
            changedRatio: length == 0 ? 0 : Double(changed) / Double(length)
        )
    }

    /// Non-overlapping literal matches, left to right — the same as repeated
    /// JavaScript `indexOf` over UTF-16, so both sides agree on "exactly once".
    static func occurrences(of needle: String, in haystack: String) -> [Range<String.Index>] {
        guard !needle.isEmpty else { return [] }
        var found: [Range<String.Index>] = []
        var searchStart = haystack.startIndex
        while searchStart < haystack.endIndex,
              let range = haystack.range(of: needle, options: .literal, range: searchStart..<haystack.endIndex) {
            found.append(range)
            searchStart = range.upperBound
        }
        return found
    }

    /// ASCII digits only, like JavaScript's `\d`.
    static func digits(_ s: String) -> String {
        String(String.UnicodeScalarView(s.unicodeScalars.filter { $0.value >= 48 && $0.value <= 57 }))
    }
}
