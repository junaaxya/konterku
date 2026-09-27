package com.konterku.companion.ui

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.konterku.companion.R
import com.konterku.companion.network.LanBridgeClient
import com.konterku.companion.network.SyncResult
import com.konterku.companion.printer.EscPosBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private lateinit var etServerUrl: EditText
    private lateinit var tvLanStatus: TextView
    private lateinit var btnTestLan: Button
    private lateinit var btnSaveConfig: Button
    private lateinit var tvPrinterModel: TextView
    private lateinit var tvBluetoothStatus: TextView
    private lateinit var btnTestPrint: Button
    private lateinit var tvPrinterMessage: TextView

    private val lanBridgeClient = LanBridgeClient()

    companion object {
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private const val PREFS_NAME = "konterku_companion_prefs"
        private const val KEY_SERVER_URL = "server_url"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initViews()
        loadSavedConfig()
        checkBluetoothStatus()

        btnSaveConfig.setOnClickListener { saveConfig() }
        btnTestLan.setOnClickListener { handleTestLan() }
        btnTestPrint.setOnClickListener { handleTestPrint() }
    }

    override fun onResume() {
        super.onResume()
        checkBluetoothStatus()
    }

    private fun initViews() {
        etServerUrl = findViewById(R.id.et_server_url)
        tvLanStatus = findViewById(R.id.tv_lan_status)
        btnTestLan = findViewById(R.id.btn_test_lan)
        btnSaveConfig = findViewById(R.id.btn_save_config)
        tvPrinterModel = findViewById(R.id.tv_printer_model)
        tvBluetoothStatus = findViewById(R.id.tv_bluetooth_status)
        btnTestPrint = findViewById(R.id.btn_test_print)
        tvPrinterMessage = findViewById(R.id.tv_printer_message)
    }

    private fun loadSavedConfig() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        etServerUrl.setText(prefs.getString(KEY_SERVER_URL, "http://192.168.1.50:3000"))
    }

    private fun saveConfig() {
        val serverUrl = etServerUrl.text.toString().trim()
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SERVER_URL, serverUrl)
            .apply()

        Toast.makeText(this, "Alamat server tersimpan.", Toast.LENGTH_SHORT).show()
    }

    private fun handleTestLan() {
        val serverUrl = etServerUrl.text.toString().trim()
        if (serverUrl.isBlank()) {
            tvLanStatus.text = "• Status: Alamat server belum diisi"
            tvLanStatus.setTextColor(getColor(R.color.danger))
            return
        }

        tvLanStatus.text = "• Status: Menghubungi server..."
        tvLanStatus.setTextColor(getColor(R.color.muted))
        btnTestLan.isEnabled = false

        lifecycleScope.launch {
            try {
                val result = lanBridgeClient.testLanConnection(serverUrl)
                when (result) {
                    is SyncResult.Success -> {
                        tvLanStatus.text = "• Status: Terhubung ke server KONTERKU (HTTP 200 OK)"
                        tvLanStatus.setTextColor(getColor(R.color.primary_dark))
                    }
                    is SyncResult.Failure -> {
                        tvLanStatus.text = "• Status: ${result.errorMessage}"
                        tvLanStatus.setTextColor(getColor(R.color.danger))
                    }
                }
            } finally {
                btnTestLan.isEnabled = true
            }
        }
    }

    private fun checkBluetoothStatus() {
        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val bluetoothAdapter = bluetoothManager?.adapter

        if (bluetoothAdapter == null) {
            tvBluetoothStatus.text = "• Status Bluetooth: Perangkat tidak mendukung Bluetooth"
            tvBluetoothStatus.setTextColor(getColor(R.color.danger))
            btnTestPrint.isEnabled = false
            return
        }

        if (!bluetoothAdapter.isEnabled) {
            tvBluetoothStatus.text = "• Status Bluetooth: Nonaktif (Nyalakan Bluetooth untuk printer)"
            tvBluetoothStatus.setTextColor(getColor(R.color.danger))
            btnTestPrint.isEnabled = false
            return
        }

        try {
            val paired = bluetoothAdapter.bondedDevices
            val epposDevice = paired?.find {
                val name = it.name ?: ""
                name.contains("EPPOS", ignoreCase = true) ||
                    name.contains("EPX", ignoreCase = true) ||
                    name.contains("RPP", ignoreCase = true) ||
                    name.contains("Printer", ignoreCase = true)
            }

            if (epposDevice != null) {
                tvBluetoothStatus.text = "• Status Bluetooth: Terpasang (${epposDevice.name})"
                tvBluetoothStatus.setTextColor(getColor(R.color.primary_dark))
            } else {
                tvBluetoothStatus.text = "• Status Bluetooth: Siap (Printer EPPOS belum dipasangkan)"
                tvBluetoothStatus.setTextColor(getColor(R.color.muted))
            }
            btnTestPrint.isEnabled = true
        } catch (_: SecurityException) {
            tvBluetoothStatus.text = "• Status Bluetooth: Izin BLUETOOTH_CONNECT diperlukan"
            tvBluetoothStatus.setTextColor(getColor(R.color.danger))
            btnTestPrint.isEnabled = false
        }
    }

    private fun handleTestPrint() {
        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val bluetoothAdapter = bluetoothManager?.adapter

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            showPrinterMessage("Bluetooth nonaktif. Aktifkan Bluetooth terlebih dahulu.", isError = true)
            return
        }

        btnTestPrint.isEnabled = false
        showPrinterMessage("Mempersiapkan data struk cetak 58mm...", isError = false)

        lifecycleScope.launch {
            val printResult = withContext(Dispatchers.IO) {
                try {
                    val paired = bluetoothAdapter.bondedDevices
                    val targetDevice = paired?.find {
                        val name = it.name ?: ""
                        name.contains("EPPOS", ignoreCase = true) ||
                            name.contains("EPX", ignoreCase = true) ||
                            name.contains("RPP", ignoreCase = true) ||
                            name.contains("Printer", ignoreCase = true)
                    }

                    if (targetDevice == null) {
                        return@withContext "Printer EPPOS EPX583-V2 belum dipasangkan di Bluetooth Android. Silakan pasangkan perangkat terlebih dahulu di Pengaturan Bluetooth."
                    }

                    val payload = EscPosBuilder.buildTestReceipt()
                    val socket = targetDevice.createRfcommSocketToServiceRecord(SPP_UUID)
                    socket.connect()
                    val outputStream: OutputStream = socket.outputStream
                    outputStream.write(payload)
                    outputStream.flush()
                    socket.close()

                    null
                } catch (e: SecurityException) {
                    "Izin akses Bluetooth belum diberikan pada aplikasi."
                } catch (e: Exception) {
                    "Gagal mencetak ke printer: ${e.message ?: "Printer tidak merespon (Verifikasi fisik tertunda)"}"
                }
            }

            btnTestPrint.isEnabled = true
            if (printResult == null) {
                showPrinterMessage("Perintah cetak 58mm berhasil dikirim ke printer.", isError = false)
            } else {
                showPrinterMessage(printResult, isError = true)
            }
        }
    }

    private fun showPrinterMessage(msg: String, isError: Boolean) {
        tvPrinterMessage.visibility = View.VISIBLE
        tvPrinterMessage.text = msg
        tvPrinterMessage.setTextColor(getColor(if (isError) R.color.danger else R.color.primary_dark))
    }
}
