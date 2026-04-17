package com.marcoreid.voice.keyboard

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.preference.PreferenceManager

class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = PreferenceManager.getDefaultSharedPreferences(this)

        val scrollView = ScrollView(this).apply {
            setPadding(32, 32, 32, 32)
        }

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        // Header
        layout.addView(TextView(this).apply {
            text = "Marco Reid Voice"
            textSize = 28f
            setTextColor(0xFF7345D1.toInt())
            setPadding(0, 0, 0, 8)
        })

        layout.addView(TextView(this).apply {
            text = "AI Voice Keyboard — v2.0.0"
            textSize = 14f
            setTextColor(0xFF6B7280.toInt())
            setPadding(0, 0, 0, 32)
        })

        // Enable keyboard button
        layout.addView(Button(this).apply {
            text = "Enable Keyboard in Settings"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            }
            setPadding(0, 0, 0, 16)
        })

        layout.addView(Button(this).apply {
            text = "Select Marco Reid Voice as Keyboard"
            setOnClickListener {
                val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                imm.showInputMethodPicker()
            }
            setPadding(0, 0, 0, 32)
        })

        // Divider
        layout.addView(divider())

        // Voice Dictation section
        layout.addView(sectionHeader("Voice Dictation"))

        layout.addView(label("Deepgram API Key"))
        val deepgramInput = EditText(this).apply {
            hint = "Enter Deepgram API key"
            setText(prefs.getString("deepgram_api_key", ""))
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            setOnFocusChangeListener { _, hasFocus ->
                if (!hasFocus) prefs.edit().putString("deepgram_api_key", text.toString()).apply()
            }
        }
        layout.addView(deepgramInput)

        layout.addView(TextView(this).apply {
            text = "Get your key at console.deepgram.com"
            textSize = 12f
            setTextColor(0xFF9CA3AF.toInt())
            setPadding(0, 4, 0, 16)
        })

        layout.addView(label("Language"))
        val languages = arrayOf(
            "English" to "en", "Spanish" to "es", "French" to "fr",
            "German" to "de", "Portuguese" to "pt", "Italian" to "it",
            "Dutch" to "nl", "Japanese" to "ja", "Korean" to "ko",
            "Chinese" to "zh", "Arabic" to "ar", "Hindi" to "hi",
            "Russian" to "ru", "Polish" to "pl", "Turkish" to "tr",
            "Swedish" to "sv", "Norwegian" to "no", "Danish" to "da",
            "Finnish" to "fi", "Indonesian" to "id"
        )
        val langSpinner = Spinner(this)
        val langAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, languages.map { it.first })
        langSpinner.adapter = langAdapter
        val currentLang = prefs.getString("language", "en") ?: "en"
        langSpinner.setSelection(languages.indexOfFirst { it.second == currentLang }.coerceAtLeast(0))
        langSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, pos: Int, id: Long) {
                prefs.edit().putString("language", languages[pos].second).apply()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
        layout.addView(langSpinner)

        layout.addView(divider())

        // Grammar AI section
        layout.addView(sectionHeader("Grammar AI"))

        layout.addView(label("AI Provider"))
        val providerSpinner = Spinner(this)
        val providers = arrayOf("Claude (Anthropic)" to "claude", "OpenAI GPT" to "openai")
        providerSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, providers.map { it.first })
        val currentProvider = prefs.getString("ai_provider", "claude") ?: "claude"
        providerSpinner.setSelection(providers.indexOfFirst { it.second == currentProvider }.coerceAtLeast(0))
        providerSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, pos: Int, id: Long) {
                prefs.edit().putString("ai_provider", providers[pos].second).apply()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
        layout.addView(providerSpinner)

        layout.addView(label("Grammar API Key"))
        val apiKeyInput = EditText(this).apply {
            hint = "Enter Claude or OpenAI API key"
            setText(prefs.getString("api_key", ""))
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            setOnFocusChangeListener { _, hasFocus ->
                if (!hasFocus) prefs.edit().putString("api_key", text.toString()).apply()
            }
        }
        layout.addView(apiKeyInput)

        layout.addView(label("Writing Style"))
        val styleSpinner = Spinner(this)
        val styles = arrayOf("Professional", "Casual", "Academic", "Creative", "Technical")
        styleSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, styles)
        val currentStyle = prefs.getString("writing_style", "professional") ?: "professional"
        styleSpinner.setSelection(styles.indexOfFirst { it.lowercase() == currentStyle }.coerceAtLeast(0))
        styleSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, pos: Int, id: Long) {
                prefs.edit().putString("writing_style", styles[pos].lowercase()).apply()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
        layout.addView(styleSpinner)

        val autoCorrectSwitch = Switch(this).apply {
            text = "Auto-Polish after dictation"
            isChecked = prefs.getBoolean("auto_correct", false)
            setPadding(0, 16, 0, 16)
            setOnCheckedChangeListener { _, checked ->
                prefs.edit().putBoolean("auto_correct", checked).apply()
            }
        }
        layout.addView(autoCorrectSwitch)

        layout.addView(divider())

        // Save button
        layout.addView(Button(this).apply {
            text = "Save Settings"
            setBackgroundColor(0xFF7345D1.toInt())
            setTextColor(0xFFFFFFFF.toInt())
            setOnClickListener {
                prefs.edit()
                    .putString("deepgram_api_key", deepgramInput.text.toString())
                    .putString("api_key", apiKeyInput.text.toString())
                    .apply()
                Toast.makeText(this@SettingsActivity, "Settings saved!", Toast.LENGTH_SHORT).show()
            }
        })

        scrollView.addView(layout)
        setContentView(scrollView)
    }

    private fun sectionHeader(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 18f
            setTextColor(0xFF374151.toInt())
            setPadding(0, 16, 0, 12)
        }
    }

    private fun label(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 14f
            setTextColor(0xFF6B7280.toInt())
            setPadding(0, 12, 0, 4)
        }
    }

    private fun divider(): android.view.View {
        return android.view.View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 1
            ).apply { setMargins(0, 24, 0, 24) }
            setBackgroundColor(0xFFE5E7EB.toInt())
        }
    }
}
