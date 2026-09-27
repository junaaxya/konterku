package com.konterku.companion.printer

object EscPosBuilder {

    private const val MAX_COLUMNS = 32

    private val ESC_INIT = byteArrayOf(0x1B, 0x40)
    private val ESC_ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0x00)
    private val ESC_ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 0x01)
    private val ESC_BOLD_ON = byteArrayOf(0x1B, 0x45, 0x01)
    private val ESC_BOLD_OFF = byteArrayOf(0x1B, 0x45, 0x00)
    private val ESC_FEED_AND_TEAR = byteArrayOf(0x1B, 0x64, 0x03)

    fun formatTwoColumns(left: String, right: String, maxColumns: Int = MAX_COLUMNS): String {
        val spaceNeeded = maxColumns - left.length - right.length
        if (spaceNeeded <= 0) {
            val rightPadded = " ".repeat(maxOf(0, maxColumns - right.length)) + right
            return "$left\n$rightPadded"
        }
        return left + " ".repeat(spaceNeeded) + right
    }

    fun centerText(text: String, maxColumns: Int = MAX_COLUMNS): String {
        if (text.length >= maxColumns) return text
        val totalPadding = maxColumns - text.length
        val leftPad = totalPadding / 2
        return " ".repeat(leftPad) + text
    }

    fun buildTestReceipt(
        storeName: String = "KONTERKU",
        txNumber: String = "TEST-PRN-001",
        dateString: String = "17 Sep 2026",
        maxColumns: Int = MAX_COLUMNS
    ): ByteArray {
        val divider = "-".repeat(maxColumns)
        val stream = java.io.ByteArrayOutputStream()

        stream.write(ESC_INIT)
        stream.write(ESC_ALIGN_CENTER)
        stream.write(ESC_BOLD_ON)
        stream.write("$storeName\n".toByteArray(Charsets.US_ASCII))
        stream.write(ESC_BOLD_OFF)
        stream.write("Uji Coba Printer Thermal\n".toByteArray(Charsets.US_ASCII))
        stream.write("$divider\n".toByteArray(Charsets.US_ASCII))

        stream.write(ESC_ALIGN_LEFT)
        stream.write((formatTwoColumns("No. Tes:", txNumber, maxColumns) + "\n").toByteArray(Charsets.US_ASCII))
        stream.write((formatTwoColumns("Waktu:", dateString, maxColumns) + "\n").toByteArray(Charsets.US_ASCII))
        stream.write((formatTwoColumns("Profil:", "${maxColumns} Kolom (58mm)", maxColumns) + "\n").toByteArray(Charsets.US_ASCII))
        stream.write("$divider\n".toByteArray(Charsets.US_ASCII))

        stream.write("Perangkat Target:\n".toByteArray(Charsets.US_ASCII))
        stream.write("EPPOS EPX583-V2 (Bluetooth)\n".toByteArray(Charsets.US_ASCII))
        stream.write("$divider\n".toByteArray(Charsets.US_ASCII))

        stream.write(ESC_ALIGN_CENTER)
        stream.write(ESC_BOLD_ON)
        stream.write("Pencetakan Berhasil!\n".toByteArray(Charsets.US_ASCII))
        stream.write(ESC_BOLD_OFF)
        stream.write("Siap mencetak struk transaksi.\n\n".toByteArray(Charsets.US_ASCII))

        stream.write(ESC_FEED_AND_TEAR)

        return stream.toByteArray()
    }
}
