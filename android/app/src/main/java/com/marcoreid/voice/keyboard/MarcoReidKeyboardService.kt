package com.marcoreid.voice.keyboard

import android.Manifest
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.inputmethodservice.InputMethodService
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.preference.PreferenceManager
import kotlinx.coroutines.*

class MarcoReidKeyboardService : InputMethodService(), DeepgramClient.DeepgramListener {

    private lateinit var prefs: SharedPreferences
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var grammarLabel: TextView? = null
    private var partialLabel: TextView? = null
    private var micButton: ImageButton? = null
    private var polishButton: Button? = null
    private var keyboardContainer: LinearLayout? = null

    private var isShifted = false
    private var isCapsLock = false
    private var isNumberMode = false
    private var isListening = false

    private var deepgramClient: DeepgramClient? = null
    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null
    private val grammarClient = GrammarClient()

    private var insertedCharCount = 0
    private var currentUtterance = StringBuilder()

    private val letterRows = arrayOf(
        arrayOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
        arrayOf("a", "s", "d", "f", "g", "h", "j", "k", "l"),
        arrayOf("z", "x", "c", "v", "b", "n", "m")
    )

    private val numberRows = arrayOf(
        arrayOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
        arrayOf("-", "/", ":", ";", "(", ")", "$", "&", "@", "\""),
        arrayOf(".", ",", "?", "!", "'")
    )

    override fun onCreateInputView(): View {
        prefs = PreferenceManager.getDefaultSharedPreferences(this)
        val view = layoutInflater.inflate(R.layout.keyboard_view, null)

        grammarLabel = view.findViewById(R.id.grammar_label)
        partialLabel = view.findViewById(R.id.partial_label)
        micButton = view.findViewById(R.id.mic_button)
        polishButton = view.findViewById(R.id.polish_button)
        keyboardContainer = view.findViewById(R.id.keyboard_container)

        micButton?.setOnClickListener { toggleDictation() }
        polishButton?.setOnClickListener { polishText() }

        buildKeyboard()
        return view
    }

    override fun onDestroy() {
        super.onDestroy()
        stopDictation()
        serviceScope.cancel()
    }

    // MARK: - Build Keyboard

    private fun buildKeyboard() {
        keyboardContainer?.removeAllViews()
        val rows = if (isNumberMode) numberRows else letterRows

        for ((index, row) in rows.withIndex()) {
            val rowLayout = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    resources.displayMetrics.density.toInt() * 42
                )
                gravity = android.view.Gravity.CENTER
            }

            // Shift key on last letter row
            if (index == 2 && !isNumberMode) {
                rowLayout.addView(createSpecialKey("⇧", ::onShiftTapped))
            }

            for (key in row) {
                val display = if (isShifted || isCapsLock) key.uppercase() else key
                rowLayout.addView(createLetterKey(display))
            }

            // Backspace on last row
            if (index == 2) {
                rowLayout.addView(createSpecialKey("⌫", ::onDeleteTapped))
            }

            keyboardContainer?.addView(rowLayout)
        }

        // Bottom row
        val bottomRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                resources.displayMetrics.density.toInt() * 42
            )
            gravity = android.view.Gravity.CENTER
        }

        bottomRow.addView(createSpecialKey(if (isNumberMode) "ABC" else "123", ::onNumberToggle))

        val spaceKey = Button(this).apply {
            text = "space"
            textSize = 14f
            isAllCaps = false
            setBackgroundResource(R.drawable.key_background)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 4f).apply {
                setMargins(2, 2, 2, 2)
            }
            setOnClickListener {
                hapticTap(it)
                currentInputConnection?.commitText(" ", 1)
            }
        }
        bottomRow.addView(spaceKey)

        val returnKey = Button(this).apply {
            text = "return"
            textSize = 14f
            isAllCaps = false
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundResource(R.drawable.key_return_background)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1.5f).apply {
                setMargins(2, 2, 2, 2)
            }
            setOnClickListener {
                hapticTap(it)
                currentInputConnection?.commitText("\n", 1)
            }
        }
        bottomRow.addView(returnKey)

        keyboardContainer?.addView(bottomRow)
    }

    private fun createLetterKey(label: String): Button {
        return Button(this).apply {
            text = label
            textSize = 20f
            isAllCaps = false
            setBackgroundResource(R.drawable.key_background)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f).apply {
                setMargins(2, 2, 2, 2)
            }
            setOnClickListener { v ->
                hapticTap(v)
                val ic = currentInputConnection ?: return@setOnClickListener
                if (label == "space") {
                    ic.commitText(" ", 1)
                } else {
                    ic.commitText(label, 1)
                }
                if (isShifted && !isCapsLock) {
                    isShifted = false
                    buildKeyboard()
                }
            }
        }
    }

    private fun createSpecialKey(label: String, action: () -> Unit): Button {
        return Button(this).apply {
            text = label
            textSize = 16f
            isAllCaps = false
            setBackgroundResource(R.drawable.key_special_background)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1.2f).apply {
                setMargins(2, 2, 2, 2)
            }
            setOnClickListener { v ->
                hapticTap(v)
                action()
            }
        }
    }

    // MARK: - Key Actions

    private fun onShiftTapped() {
        if (isShifted) {
            if (isCapsLock) {
                isCapsLock = false
                isShifted = false
            } else {
                isCapsLock = true
            }
        } else {
            isShifted = true
        }
        buildKeyboard()
    }

    private fun onDeleteTapped() {
        currentInputConnection?.deleteSurroundingText(1, 0)
    }

    private fun onNumberToggle() {
        isNumberMode = !isNumberMode
        buildKeyboard()
    }

    private fun hapticTap(view: View) {
        view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
    }

    // MARK: - Voice Dictation

    private fun toggleDictation() {
        if (isListening) {
            stopDictation()
        } else {
            startDictation()
        }
    }

    private fun startDictation() {
        val apiKey = prefs.getString("deepgram_api_key", "") ?: ""
        if (apiKey.isBlank()) {
            grammarLabel?.text = "Set Deepgram key in settings"
            return
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            grammarLabel?.text = "Mic permission required — open settings"
            return
        }

        val language = prefs.getString("language", "en") ?: "en"

        deepgramClient = DeepgramClient(apiKey, language, this)
        deepgramClient?.connect()

        val sampleRate = 16000
        val bufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            bufferSize * 2
        )

        audioRecord?.startRecording()
        isListening = true
        insertedCharCount = 0
        currentUtterance.clear()

        micButton?.setColorFilter(0xFFEF4444.toInt())
        grammarLabel?.text = "Listening..."

        recordingJob = serviceScope.launch(Dispatchers.IO) {
            val buffer = ByteArray(bufferSize)
            while (isListening) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                if (read > 0) {
                    deepgramClient?.sendAudio(buffer.copyOf(read))
                }
            }
        }
    }

    private fun stopDictation() {
        isListening = false
        recordingJob?.cancel()
        recordingJob = null
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        deepgramClient?.disconnect()
        deepgramClient = null
        insertedCharCount = 0
        currentUtterance.clear()

        micButton?.clearColorFilter()
        grammarLabel?.text = "Marco Reid Voice"
        partialLabel?.visibility = View.GONE
    }

    // MARK: - DeepgramListener

    override fun onPartialTranscript(text: String) {
        serviceScope.launch {
            partialLabel?.text = text
            partialLabel?.visibility = View.VISIBLE
        }
    }

    override fun onFinalTranscript(text: String) {
        serviceScope.launch {
            val ic = currentInputConnection ?: return@launch

            // Delete previously inserted partial text
            if (insertedCharCount > 0) {
                ic.deleteSurroundingText(insertedCharCount, 0)
            }

            val toInsert = "$text "
            ic.commitText(toInsert, 1)
            insertedCharCount = toInsert.length
            currentUtterance.append(toInsert)

            partialLabel?.visibility = View.GONE
        }
    }

    override fun onSpeechFinal(text: String) {
        serviceScope.launch {
            val ic = currentInputConnection ?: return@launch

            if (insertedCharCount > 0) {
                ic.deleteSurroundingText(insertedCharCount, 0)
            }

            val toInsert = "$text "
            ic.commitText(toInsert, 1)
            insertedCharCount = 0

            val fullUtterance = currentUtterance.toString().trim()
            currentUtterance.clear()

            partialLabel?.visibility = View.GONE

            // Auto-polish if enabled
            val autoCorrect = prefs.getBoolean("auto_correct", false)
            if (autoCorrect && fullUtterance.isNotBlank()) {
                autoPolish(fullUtterance)
            }
        }
    }

    override fun onError(error: String) {
        serviceScope.launch {
            grammarLabel?.text = "Error: $error"
        }
    }

    override fun onConnected() {
        serviceScope.launch {
            grammarLabel?.text = "Listening..."
        }
    }

    override fun onDisconnected() {
        serviceScope.launch {
            if (isListening) stopDictation()
        }
    }

    // MARK: - Grammar Correction

    private fun polishText() {
        val ic = currentInputConnection ?: return
        val beforeCursor = ic.getTextBeforeCursor(500, 0)?.toString() ?: return
        if (beforeCursor.isBlank()) return

        val textToPolish = extractLastSentence(beforeCursor)
        grammarLabel?.text = "Polishing..."
        polishButton?.isEnabled = false

        serviceScope.launch {
            try {
                val provider = prefs.getString("ai_provider", "claude") ?: "claude"
                val apiKey = prefs.getString("api_key", "") ?: ""
                val style = prefs.getString("writing_style", "professional") ?: "professional"

                val corrected = grammarClient.correctGrammar(textToPolish, provider, apiKey, style)

                ic.deleteSurroundingText(textToPolish.length, 0)
                ic.commitText(corrected, 1)

                grammarLabel?.text = "Polished!"
                polishButton?.isEnabled = true

                delay(2000)
                grammarLabel?.text = "Marco Reid Voice"
            } catch (e: Exception) {
                grammarLabel?.text = "Error — check API key"
                polishButton?.isEnabled = true
            }
        }
    }

    private fun autoPolish(text: String) {
        serviceScope.launch {
            try {
                val provider = prefs.getString("ai_provider", "claude") ?: "claude"
                val apiKey = prefs.getString("api_key", "") ?: ""
                val style = prefs.getString("writing_style", "professional") ?: "professional"
                if (apiKey.isBlank()) return@launch

                grammarLabel?.text = "Polishing..."
                val corrected = grammarClient.correctGrammar(text, provider, apiKey, style)

                val ic = currentInputConnection ?: return@launch
                ic.deleteSurroundingText(text.length + 1, 0)
                ic.commitText("$corrected ", 1)

                grammarLabel?.text = "Marco Reid Voice"
            } catch (_: Exception) {
                grammarLabel?.text = "Marco Reid Voice"
            }
        }
    }

    private fun extractLastSentence(text: String): String {
        val endings = charArrayOf('.', '!', '?', '\n')
        val lastIndex = text.dropLast(1).lastIndexOfAny(endings)
        return if (lastIndex >= 0) {
            text.substring(lastIndex + 1).trim()
        } else {
            text
        }
    }
}
