package com.baritzy.subtracker.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.baritzy.subtracker.data.db.dao.SubscriptionDao
import com.baritzy.subtracker.data.db.dao.InvoiceDao
import com.baritzy.subtracker.data.model.Subscription
import com.baritzy.subtracker.data.model.Invoice

@Database(
    entities = [Subscription::class, Invoice::class],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun subscriptionDao(): SubscriptionDao
    abstract fun invoiceDao(): InvoiceDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE subscriptions ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1")
            }
        }
    }
}
