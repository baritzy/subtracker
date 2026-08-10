import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
    id("com.google.gms.google-services")
}

// --- Release signing ---
// Credentials live in keystore.properties (project root, gitignored) and are
// NEVER hardcoded here. See keystore.properties.example for the expected shape.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
val keystorePropertiesExist = keystorePropertiesFile.exists()
if (keystorePropertiesExist) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

// Fail the build loudly if a release task is requested without the keystore
// properties present. A silent fallback to an unsigned/debug-signed release
// build would be far worse than a hard error here.
val isReleaseTaskRequested = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
if (isReleaseTaskRequested && !keystorePropertiesExist) {
    throw GradleException(
        "Missing keystore.properties at the project root (next to settings.gradle.kts). " +
            "Release builds must be signed with the existing production key, so this build " +
            "is being stopped instead of silently producing an unsigned or debug-signed " +
            "release. Create keystore.properties there with these four keys: " +
            "storeFile, storePassword, keyAlias, keyPassword " +
            "(see keystore.properties.example for the expected format and placeholder values)."
    )
}

android {
    namespace = "com.baritzy.subtracker"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.baritzy.subtracker"
        minSdk = 26
        targetSdk = 36
        versionCode = 44
        versionName = "3.8.3"

        buildConfigField("String", "API_BASE_URL", "\"https://subtracker-nm4n.onrender.com/api\"")
        buildConfigField("String", "GOOGLE_CLIENT_ID", "\"692989718499-326hv6pg6co1o3dckelld42p4u4ma53h.apps.googleusercontent.com\"")
    }

    signingConfigs {
        if (keystorePropertiesExist) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false  // disabled for first release to avoid Proguard issues
            isShrinkResources = false
            if (keystorePropertiesExist) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.animation:animation")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Core Android
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // Hilt DI
    implementation("com.google.dagger:hilt-android:2.53.1")
    ksp("com.google.dagger:hilt-compiler:2.53.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Retrofit + OkHttp
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Room DB
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Coil (image loading)
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Google Sign-In
    implementation("com.google.android.gms:play-services-auth:21.3.0")
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.google.firebase:firebase-analytics-ktx")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // DataStore (replacement for SharedPreferences)
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Gson
    implementation("com.google.code.gson:gson:2.11.0")

    // Splash screen
    implementation("androidx.core:core-splashscreen:1.0.1")

    // AdMob
    implementation("com.google.android.gms:play-services-ads:23.1.0")
    // Google Play Billing
    implementation("com.android.billingclient:billing-ktx:8.0.0")
}
