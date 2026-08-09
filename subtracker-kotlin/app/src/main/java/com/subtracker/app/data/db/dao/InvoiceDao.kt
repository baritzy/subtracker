package com.baritzy.subtracker.data.db.dao

import androidx.room.*
import com.baritzy.subtracker.data.model.Invoice
import kotlinx.coroutines.flow.Flow

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM invoices WHERE subscription_id = :subscriptionId ORDER BY invoice_date DESC")
    fun getBySubscriptionId(subscriptionId: Int): Flow<List<Invoice>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(invoices: List<Invoice>)

    @Query("DELETE FROM invoices WHERE subscription_id = :subscriptionId")
    suspend fun deleteBySubscriptionId(subscriptionId: Int)
}
