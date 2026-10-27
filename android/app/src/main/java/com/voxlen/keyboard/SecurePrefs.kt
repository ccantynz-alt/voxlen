package com.voxlen.keyboard

import android.content.Context
import android.content.SharedPreferences
import androidx.preference.PreferenceManager
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Keystore-backed storage for API keys. Non-secret settings stay in the
 * default SharedPreferences; only key material lives here. Legacy plaintext
 * values written by earlier builds are migrated on first access.
 */
object SecurePrefs {

    val SECRET_KEYS = listOf("deepgram_api_key", "api_key")

    @Volatile
    private var cached: SharedPreferences? = null

    fun get(context: Context): SharedPreferences {
        cached?.let { return it }
        synchronized(this) {
            cached?.let { return it }
            val masterKey = MasterKey.Builder(context.applicationContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            val prefs = EncryptedSharedPreferences.create(
                context.applicationContext,
                "voxlen_secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
            migrateLegacy(context.applicationContext, prefs)
            cached = prefs
            return prefs
        }
    }

    fun getSecret(context: Context, key: String): String =
        get(context).getString(key, "") ?: ""

    fun setSecret(context: Context, key: String, value: String) {
        get(context).edit().putString(key, value).apply()
    }

    private fun migrateLegacy(context: Context, secure: SharedPreferences) {
        val legacy = PreferenceManager.getDefaultSharedPreferences(context)
        val editSecure = secure.edit()
        val editLegacy = legacy.edit()
        var migrated = false
        for (key in SECRET_KEYS) {
            val value = legacy.getString(key, null)
            if (!value.isNullOrEmpty() && secure.getString(key, null).isNullOrEmpty()) {
                editSecure.putString(key, value)
                migrated = true
            }
            if (value != null) {
                editLegacy.remove(key)
                migrated = true
            }
        }
        if (migrated) {
            editSecure.apply()
            editLegacy.apply()
        }
    }
}
