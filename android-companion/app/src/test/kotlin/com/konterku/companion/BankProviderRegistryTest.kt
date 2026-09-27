package com.konterku.companion

import com.konterku.companion.reader.BankProviderRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BankProviderRegistryTest {

    @Test
    fun `verifies all configured providers are registered`() {
        val providers = BankProviderRegistry.ALL_PROVIDERS
        assertEquals(5, providers.size)

        val codes = providers.map { it.providerCode }.toSet()
        assertTrue(codes.contains("BRI"))
        assertTrue(codes.contains("BCA"))
        assertTrue(codes.contains("MANDIRI"))
        assertTrue(codes.contains("BNI"))
        assertTrue(codes.contains("SEABANK"))
    }

    @Test
    fun `resolves provider by official package name`() {
        val bri = BankProviderRegistry.findProviderByPackage("id.co.bri.brimo")
        assertNotNull(bri)
        assertEquals("BRI", bri?.providerCode)

        val bca1 = BankProviderRegistry.findProviderByPackage("com.bca.mybca")
        assertNotNull(bca1)
        assertEquals("BCA", bca1?.providerCode)

        val bca2 = BankProviderRegistry.findProviderByPackage("com.bca")
        assertNotNull(bca2)
        assertEquals("BCA", bca2?.providerCode)

        val mandiri = BankProviderRegistry.findProviderByPackage("id.bmri.livin")
        assertNotNull(mandiri)
        assertEquals("MANDIRI", mandiri?.providerCode)

        val bni1 = BankProviderRegistry.findProviderByPackage("id.co.bni.wondr")
        assertNotNull(bni1)
        assertEquals("BNI", bni1?.providerCode)

        val seabank = BankProviderRegistry.findProviderByPackage("com.seabank.mobile")
        assertNotNull(seabank)
        assertEquals("SEABANK", seabank?.providerCode)
    }

    @Test
    fun `returns null and false for unsupported arbitrary app packages`() {
        assertFalse(BankProviderRegistry.isSupportedPackage("com.whatsapp"))
        assertFalse(BankProviderRegistry.isSupportedPackage("com.android.chrome"))
        assertFalse(BankProviderRegistry.isSupportedPackage("com.fake.bank"))

        assertNull(BankProviderRegistry.findProviderByPackage("com.whatsapp"))
    }
}
