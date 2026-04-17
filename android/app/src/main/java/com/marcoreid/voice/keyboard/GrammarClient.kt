package com.marcoreid.voice.keyboard

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class GrammarClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json".toMediaType()

    suspend fun correctGrammar(
        text: String,
        provider: String,
        apiKey: String,
        style: String = "professional"
    ): String = withContext(Dispatchers.IO) {
        if (apiKey.isBlank()) throw IllegalStateException("No API key")

        when (provider) {
            "claude" -> correctWithClaude(text, apiKey, style)
            "openai" -> correctWithOpenAI(text, apiKey, style)
            else -> correctWithClaude(text, apiKey, style)
        }
    }

    private fun correctWithClaude(text: String, apiKey: String, style: String): String {
        val prompt = "Fix grammar, spelling, and punctuation in this text. " +
            "Make it $style. Return ONLY the corrected text, nothing else: \"$text\""

        val body = JSONObject().apply {
            put("model", "claude-haiku-4-5-20251001")
            put("max_tokens", 1024)
            put("messages", JSONArray().apply {
                put(JSONObject().apply {
                    put("role", "user")
                    put("content", prompt)
                })
            })
        }

        val request = Request.Builder()
            .url("https://api.anthropic.com/v1/messages")
            .addHeader("x-api-key", apiKey)
            .addHeader("anthropic-version", "2023-06-01")
            .addHeader("content-type", "application/json")
            .post(body.toString().toRequestBody(jsonType))
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw RuntimeException("API error: ${response.code}")

        val json = JSONObject(response.body?.string() ?: "")
        val content = json.getJSONArray("content").getJSONObject(0)
        val corrected = content.getString("text")

        return corrected.trim().trim('"')
    }

    private fun correctWithOpenAI(text: String, apiKey: String, style: String): String {
        val prompt = "Fix grammar, spelling, and punctuation. " +
            "Make it $style. Return ONLY the corrected text: \"$text\""

        val body = JSONObject().apply {
            put("model", "gpt-4o-mini")
            put("temperature", 0.1)
            put("messages", JSONArray().apply {
                put(JSONObject().apply {
                    put("role", "user")
                    put("content", prompt)
                })
            })
        }

        val request = Request.Builder()
            .url("https://api.openai.com/v1/chat/completions")
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .post(body.toString().toRequestBody(jsonType))
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw RuntimeException("API error: ${response.code}")

        val json = JSONObject(response.body?.string() ?: "")
        val choices = json.getJSONArray("choices")
        val message = choices.getJSONObject(0).getJSONObject("message")
        val corrected = message.getString("content")

        return corrected.trim().trim('"')
    }
}
