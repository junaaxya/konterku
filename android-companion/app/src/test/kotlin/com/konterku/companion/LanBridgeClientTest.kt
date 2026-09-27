package com.konterku.companion

import com.konterku.companion.model.BalanceSyncPayload
import com.konterku.companion.network.LanBridgeClient
import com.konterku.companion.network.SyncResult
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LanBridgeClientTest {

    private val client = LanBridgeClient(connectTimeoutMs = 1000, readTimeoutMs = 1000)

    @Test
    fun `validates private LAN hosts and rejects public internet domains`() {
        assertTrue(client.isPrivateLanHost("192.168.1.1"))
        assertTrue(client.isPrivateLanHost("192.168.100.55"))
        assertTrue(client.isPrivateLanHost("10.0.0.1"))
        assertTrue(client.isPrivateLanHost("10.254.1.1"))
        assertTrue(client.isPrivateLanHost("172.16.0.1"))
        assertTrue(client.isPrivateLanHost("172.20.10.5"))
        assertTrue(client.isPrivateLanHost("172.31.255.254"))
        assertTrue(client.isPrivateLanHost("localhost"))
        assertTrue(client.isPrivateLanHost("127.0.0.1"))
        assertTrue(client.isPrivateLanHost("10.0.2.2"))

        assertFalse(client.isPrivateLanHost("google.com"))
        assertFalse(client.isPrivateLanHost("api.bankbca.com"))
        assertFalse(client.isPrivateLanHost("8.8.8.8"))
        assertFalse(client.isPrivateLanHost("172.32.0.1"))
        assertFalse(client.isPrivateLanHost("1.1.1.1"))
    }

    @Test
    fun `rejects public or cloud URLs before network dispatch`() = runBlocking {
        val payload = BalanceSyncPayload(
            accountId = "cmu12345",
            providerCode = "BCA",
            accountIdentifier = "0123456789",
            balance = "1000000",
            observedAt = "2026-09-16T15:00:00Z"
        )

        val resultPublicDomain = client.sendBalance("http://api.konterku.cloud", "ktk_secret", payload)
        assertTrue(resultPublicDomain is SyncResult.Failure)
        assertTrue((resultPublicDomain as SyncResult.Failure).errorMessage.contains("Hanya alamat IP jaringan lokal"))

        val resultPublicIp = client.sendBalance("http://157.240.22.35:3000", "ktk_secret", payload)
        assertTrue(resultPublicIp is SyncResult.Failure)
        assertTrue((resultPublicIp as SyncResult.Failure).errorMessage.contains("Hanya alamat IP jaringan lokal"))
    }

    @Test
    fun `rejects blank server url or pairing token before network request`() = runBlocking {
        val payload = BalanceSyncPayload(
            accountId = "cmu12345",
            providerCode = "BCA",
            accountIdentifier = "0123456789",
            balance = "1000000",
            observedAt = "2026-09-16T15:00:00Z"
        )

        val resultNoUrl = client.sendBalance("", "ktk_secret", payload)
        assertTrue(resultNoUrl is SyncResult.Failure)
        assertEquals("Alamat URL server KONTERKU belum diisi.", (resultNoUrl as SyncResult.Failure).errorMessage)

        val resultNoToken = client.sendBalance("http://192.168.1.50:3000", "", payload)
        assertTrue(resultNoToken is SyncResult.Failure)
        assertEquals("Token pairing belum diisi.", (resultNoToken as SyncResult.Failure).errorMessage)
    }

    @Test
    fun `rejects invalid payload without network dispatch`() = runBlocking {
        val invalidPayload = BalanceSyncPayload(
            accountId = "",
            providerCode = "BCA",
            accountIdentifier = "",
            balance = "invalid_number",
            observedAt = "2026-09-16T15:00:00Z"
        )

        val result = client.sendBalance("http://192.168.1.50:3000", "ktk_secret", invalidPayload)
        assertTrue(result is SyncResult.Failure)
        assertEquals("Payload saldo tidak valid.", (result as SyncResult.Failure).errorMessage)
    }
}
