package com.konterku.companion.network

sealed class SyncResult {
    data class Success(
        val snapshotId: String?,
        val balance: String?,
        val observedAt: String?
    ) : SyncResult()

    data class Failure(
        val errorMessage: String,
        val statusCode: Int? = null
    ) : SyncResult()
}
