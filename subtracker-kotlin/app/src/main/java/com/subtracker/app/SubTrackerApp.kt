package com.baritzy.subtracker

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class SubTrackerApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        val manager = getSystemService(NotificationManager::class.java)

        val renewalChannel = NotificationChannel(
            "renewal_reminders",
            "תזכורות חידוש",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "התראות על מנויים שמתחדשים בקרוב"
            enableVibration(true)
        }

        val generalChannel = NotificationChannel(
            "general",
            "כללי",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "התראות כלליות"
        }

        manager.createNotificationChannel(renewalChannel)
        manager.createNotificationChannel(generalChannel)
    }
}
