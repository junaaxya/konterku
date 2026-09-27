package com.konterku.companion.network

import com.konterku.companion.model.BalanceSyncPayload
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class LanBridgeClient(
    private val connectTimeoutMs: Int = 5000,
    private val readTimeoutMs: Int = 10000
) {

    fun isPrivateLanHost(host: String): Boolean {
        val trimmed = host.trim().lowercase()

        if (trimmed == "localhost" || trimmed == "127.0.0.1" || trimmed == "10.0.2.2") {
            return true
        }

        val parts = trimmed.split(".")
        if (parts.size == 4) {
            val octets = parts.mapNotNull { it.toIntOrNull() }
            if (octets.size == 4 && octets.all { it in 0..255 }) {
                val o1 = octets[0]
                val o2 = octets[1]

                if (o1 == 10) return true
                if (o1 == 192 && o2 == 168) return true
                if (o1 == 172 && o2 in 16..31) return true
                if (o1 == 127) return true
            }
        }

        return false
    }

    suspend fun testLanConnection(serverBaseUrl: String): SyncResult = withContext(Dispatchers.IO) {
        if (serverBaseUrl.isBlank()) {
            return@withContext SyncResult.Failure("Alamat URL server KONTERKU belum diisi.")
        }

        val cleanUrl = serverBaseUrl.trim().removeSuffix("/")

        val host = try {
            URL(cleanUrl).host
        } catch (_: Exception) {
            return@withContext SyncResult.Failure("Format URL server tidak valid.")
        }

        if (!isPrivateLanHost(host)) {
            return@withContext SyncResult.Failure(
                "Keamanan: Hanya alamat IP jaringan lokal (LAN) privat yang diizinkan (misal: 192.168.x.x, 10.x.x.x). Endpoint publik/cloud dilarang."
            )
        }

        val endpointUrl = "$cleanUrl/api/health"
        var connection: HttpURLConnection? = null
        try {
            val url = URL(endpointUrl)
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = connectTimeoutMs
                readTimeout = readTimeoutMs
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "KONTERKU-Companion-Android/1.0")
            }

            val responseCode = connection.responseCode
            if (responseCode in 200..299) {
                SyncResult.Success(null, null, null)
            } else {
                SyncResult.Failure("Server merespon HTTP $responseCode", responseCode)
            }
        } catch (e: Exception) {
            SyncResult.Failure("Tidak dapat terhubung ke $endpointUrl: ${e.message ?: "Koneksi terputus"}")
        } finally {
            connection?.disconnect()
        }
    }

    suspend fun sendBalance(
        serverBaseUrl: String,
        pairingToken: String,
        payload: BalanceSyncPayload
    ): SyncResult = withContext(Dispatchers.IO) {
        if (!payload.isValid()) {
            return@withContext SyncResult.Failure("Payload saldo tidak valid.")
        }

        if (serverBaseUrl.isBlank()) {
            return@withContext SyncResult.Failure("Alamat URL server KONTERKU belum diisi.")
        }

        if (pairingToken.isBlank()) {
            return@withContext SyncResult.Failure("Token pairing belum diisi.")
        }

        val cleanUrl = serverBaseUrl.trim().removeSuffix("/")

        val host = try {
            URL(cleanUrl).host
        } catch (_: Exception) {
            return@withContext SyncResult.Failure("Format URL server tidak valid.")
        }

        if (!isPrivateLanHost(host)) {
            return@withContext SyncResult.Failure(
                "Keamanan: Hanya alamat IP jaringan lokal (LAN) privat yang diizinkan (misal: 192.168.x.x, 10.x.x.x). Endpoint publik/cloud dilarang."
            )
        }

        val endpointUrl = "$cleanUrl/api/connector/balance"

        var connection: HttpURLConnection? = null
        try {
            val url = URL(endpointUrl)
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = connectTimeoutMs
                readTimeout = readTimeoutMs
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $pairingToken")
                setRequestProperty("User-Agent", "KONTERKU-Companion-Android/1.0")
            }

            val jsonBody = payload.toJsonString()
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(jsonBody)
                writer.flush()
            }

            val responseCode = connection.responseCode
            val isSuccess = responseCode in 200..299

            val inputStream = if (isSuccess) connection.inputStream else connection.errorStream
            val responseText = inputStream?.let { stream ->
                BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { reader ->
                    reader.readText()
                }
            } ?: ""

            if (isSuccess) {
                val snapshotId = extractJsonString(responseText, "snapshotId")
                val balance = extractJsonString(responseText, "balance")
                val observedAt = extractJsonString(responseText, "observedAt")
                SyncResult.Success(snapshotId, balance, observedAt)
            } else {
                val errorMsg = extractJsonString(responseText, "error")
                    ?: "Server KONTERKU merespon status HTTP $responseCode"
                SyncResult.Failure(errorMsg, responseCode)
            }
        } catch (e: Exception) {
            SyncResult.Failure("Gagal terhubung ke server KONTERKU via LAN: ${e.message ?: "Koneksi terputus"}")
        } finally {
            connection?.disconnect()
        }
    }

    private fun extractJsonString(json: String, key: String): String? {
        val pattern = Regex(""""$key"\s*:\s*"([^"]+)"""")
        return pattern.find(json)?.groupValues?.get(1)
    }
}
