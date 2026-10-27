import SwiftUI
import VoxlenCore
import VoxlenSecrets

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var tryText = ""

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Section {
                    SetupStep(
                        done: model.keyboardSeen,
                        title: "Add the Voxlen keyboard",
                        detail: "Settings › Voxlen › Keyboards › Voxlen. Then tap the globe key in any app and pick Voxlen."
                    )
                    SetupStep(
                        done: model.keyboardHasFullAccess,
                        title: "Allow Full Access",
                        detail: "Fix needs it to reach the grammar service. Typing works without it, and Voxlen never logs what you type."
                    )
                    Button("Open Voxlen Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                } header: {
                    Text("Keyboard")
                } footer: {
                    if !model.keyboardSeen {
                        Text("These tick once the keyboard has been shown in another app.")
                    }
                }

                Section("Connect") {
                    Picker("Check grammar with", selection: $model.route) {
                        Text("Voxlen account").tag(FixRoute.account)
                        Text("My Anthropic API key").tag(FixRoute.anthropicKey)
                    }
                    switch model.route {
                    case .account:
                        SecretField(
                            label: "Voxlen account key",
                            hint: "Copy it from voxlen.ai/dashboard.",
                            isSet: model.hasAccountToken,
                            save: { model.save($0, for: .voxlenAccountToken) },
                            remove: { model.remove(.voxlenAccountToken) }
                        )
                    case .anthropicKey:
                        SecretField(
                            label: "Anthropic API key",
                            hint: "Text goes straight from your phone to Anthropic, billed to your key.",
                            isSet: model.hasAnthropicKey,
                            save: { model.save($0, for: .anthropicAPIKey) },
                            remove: { model.remove(.anthropicAPIKey) }
                        )
                    }
                    if let error = model.secretError {
                        Text(error).foregroundStyle(.red).font(.footnote)
                    }
                }

                Section {
                    Picker("Spelling", selection: $model.locale) {
                        ForEach(FixLocale.allCases, id: \.self) { Text($0.displayName).tag($0) }
                    }
                    NavigationLink {
                        ProtectedTermsView()
                    } label: {
                        LabeledContent("Protected terms", value: "\(model.protectedTerms.count)")
                    }
                } header: {
                    Text("Proofreading")
                } footer: {
                    Text("Fix only corrects real errors and keeps your wording. It never changes numbers, dates, citations or your protected terms, and never switches your spelling to another dialect.")
                }

                Section("Try it") {
                    TextField("Type here with the Voxlen keyboard, then tap Fix", text: $tryText, axis: .vertical)
                        .lineLimit(3...8)
                }

                Section("Privacy") {
                    Text("Voxlen sends the sentence you ask it to fix — nothing else — to be checked, and keeps none of it. Your keys stay in this device's keychain.")
                        .font(.footnote)
                    Link("Privacy policy", destination: URL(string: "https://www.voxlen.ai/privacy")!)
                }
            }
            .navigationTitle("Voxlen")
        }
    }
}

private struct SetupStep: View {
    let done: Bool
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(done ? .green : .secondary)
                .font(.title3)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.medium))
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(done ? "Done" : "Not done")
    }
}

private struct SecretField: View {
    let label: String
    let hint: String
    let isSet: Bool
    let save: (String) -> Void
    let remove: () -> Void
    @State private var draft = ""

    var body: some View {
        if isSet {
            LabeledContent(label) {
                Label("Saved", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
            }
            Button("Remove \(label.lowercased())", role: .destructive, action: remove)
        } else {
            SecureField(label, text: $draft)
                .textContentType(.password)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            Button("Save") {
                save(draft)
                draft = ""
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            Text(hint).font(.footnote).foregroundStyle(.secondary)
        }
    }
}

struct ProtectedTermsView: View {
    @Environment(AppModel.self) private var model
    @State private var newTerm = ""

    var body: some View {
        @Bindable var model = model
        List {
            Section {
                HStack {
                    TextField("Name, matter or defined term", text: $newTerm)
                        .onSubmit(add)
                    Button("Add", action: add)
                        .disabled(newTerm.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            } footer: {
                Text("Fix never edits these, exactly as written: client and party names, matter names, defined terms, unusual spellings.")
            }
            Section {
                ForEach(model.protectedTerms, id: \.self) { Text($0) }
                    .onDelete { model.protectedTerms.remove(atOffsets: $0) }
            }
        }
        .navigationTitle("Protected terms")
        .toolbar { EditButton() }
    }

    private func add() {
        model.addTerm(newTerm)
        newTerm = ""
    }
}
