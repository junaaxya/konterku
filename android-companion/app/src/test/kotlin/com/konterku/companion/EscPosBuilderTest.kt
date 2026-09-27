package com.konterku.companion

import com.konterku.companion.printer.EscPosBuilder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EscPosBuilderTest {

    @Test
    fun `formats two columns to exact 32-character boundary`() {
        val line = EscPosBuilder.formatTwoColumns("No. Tes:", "TEST-001", 32)
        assertEquals(32, line.length)
        assertTrue(line.startsWith("No. Tes:"))
        assertTrue(line.endsWith("TEST-001"))
    }

    @Test
    fun `centers text across 32 columns`() {
        val centered = EscPosBuilder.centerText("KONTERKU", 32)
        assertEquals(20, centered.length)
        assertEquals("            KONTERKU", centered)
        assertTrue(centered.trim() == "KONTERKU")
    }

    @Test
    fun `generates valid ESC-POS binary test receipt with init and feed-cut commands`() {
        val receiptBytes = EscPosBuilder.buildTestReceipt(
            storeName = "KONTERKU",
            txNumber = "TEST-PRN-001",
            dateString = "17 Sep 2026",
            maxColumns = 32
        )

        assertTrue(receiptBytes.isNotEmpty())
        assertTrue(receiptBytes.size > 50)

        // Starts with ESC @ (0x1B, 0x40)
        assertEquals(0x1B.toByte(), receiptBytes[0])
        assertEquals(0x40.toByte(), receiptBytes[1])

        // Ends with feed and tear (0x1B, 0x64, 0x03)
        val len = receiptBytes.size
        assertEquals(0x1B.toByte(), receiptBytes[len - 3])
        assertEquals(0x64.toByte(), receiptBytes[len - 2])
        assertEquals(0x03.toByte(), receiptBytes[len - 1])

        val text = String(receiptBytes, Charsets.US_ASCII)
        assertTrue(text.contains("KONTERKU"))
        assertTrue(text.contains("EPPOS EPX583-V2"))
        assertTrue(text.contains("TEST-PRN-001"))
    }
}
