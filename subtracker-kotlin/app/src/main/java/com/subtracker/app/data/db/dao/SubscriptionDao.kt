package com.baritzy.subtracker.data.db.dao

import androidx.room.*
import com.baritzy.subtracker.data.model.Subscription
import kotlinx.coroutines.flow.Flow

@Dao
interface SubscriptionDao {
    @Query("SELECT * FROM subscriptions WHERE status = :status ORDER BY renewal_date ASC")
    fun getByStatus(status: String): Flow<List<Subscription>>

    @Query("SELECT * FROM subscriptions ORDER BY renewal_date ASC")
    fun getAll(): Flow<List<Subscription>>

    @Query("SELECT * FROM subscriptions WHERE id = :id")
    suspend fun getById(id: Int): Subscription?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(subscriptions: List<Subscription>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(subscription: Subscription)

    @Update
    suspend fun update(subscription: Subscription)

    @Delete
    suspend fun delete(subscription: Subscription)

    @Query("DELETE FROM subscriptions WHERE id = :id")
    suspend fun deleteById(id: Int)

    @Query("DELETE FROM subscriptions")
    suspend fun deleteAll()

    @Query("SELECT * FROM subscriptions WHERE status = 'active' AND is_trial = 1")
    fun getActiveTrials(): Flow<List<Subscription>>

    @Query("SELECT * FROM subscriptions WHERE status = 'pending'")
    fun getPending(): Flow<List<Subscription>>
}
