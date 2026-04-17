package com.marcoreid.voice.keyboard

import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class DeepgramClient(
    private val apiKey: String,
    private val language: String = "en",
    private val listener: DeepgramListener
) {
    interface DeepgramListener {
        fun onPartialTranscript(text: String)
        fun onFinalTranscript(text: String)
        fun onSpeechFinal(text: String)
        fun onError(error: String)
        fun onConnected()
        fun onDisconnected()
    }

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    fun connect() {
        val url = "wss://api.deepgram.com/v1/listen?" +
            "model=nova-2&punctuate=true&smart_format=true" +
            "&interim_results=true&endpointing=300" +
            "&encoding=linear16&sample_rate=16000&channels=1" +
            "&language=$language"

        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Token $apiKey")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                listener.onConnected()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    val channel = json.optJSONObject("channel") ?: return
                    val alternatives = channel.optJSONArray("alternatives") ?: return
                    if (alternatives.length() == 0) return

                    val first = alternatives.getJSONObject(0)
                    val transcript = first.optString("transcript", "")
                    if (transcript.isEmpty()) return

                    val isFinal = json.optBoolean("is_final", false)
                    val speechFinal = json.optBoolean("speech_final", false)

                    when {
                        speechFinal -> listener.onSpeechFinal(transcript)
                        isFinal -> listener.onFinalTranscript(transcript)
                        else -> listener.onPartialTranscript(transcript)
                    }
                } catch (e: Exception) {
                    // Malformed response — skip
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                listener.onError(t.message ?: "WebSocket error")
                listener.onDisconnected()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                listener.onDisconnected()
            }
        })
    }

    fun sendAudio(data: ByteArray) {
        webSocket?.send(okio.ByteString.of(*data))
    }

    fun disconnect() {
        webSocket?.close(1000, "User stopped dictation")
        webSocket = null
    }

    fun shutdown() {
        disconnect()
        client.dispatcher.executorService.shutdown()
    }
}
