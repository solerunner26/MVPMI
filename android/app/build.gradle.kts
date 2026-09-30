import java.net.URI

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

// The server address is built into the app and can never be seen or changed
// by members (there is no server setting anywhere in the app):
//   release: gradle assembleRelease -PcommunityUrl=https://directory.example.org
//   debug:   gradle assembleDebug   -PcommunityDebugUrl=https://test.example.org
//            (defaults to communityUrl; a private-network http:// address such
//            as http://10.0.2.2:3000 is allowed for debug builds only)
// It must be the ROOT of the site (a sub-domain is fine, a sub-folder such as
// https://example.org/directory is not: the web app uses /api paths).
val communityUrl = providers.gradleProperty("communityUrl").orElse("https://example.invalid").get().trimEnd('/')
val communityDebugUrl = providers.gradleProperty("communityDebugUrl").orElse(communityUrl).get().trimEnd('/')
fun siteRoot(raw: String, allowHttp: Boolean): URI {
    val uri = URI(raw)
    require(
        (uri.scheme == "https" || (allowHttp && uri.scheme == "http")) && uri.host != null &&
            uri.rawUserInfo == null && uri.rawQuery == null &&
            uri.rawFragment == null && uri.rawPath.isNullOrEmpty(),
    ) { "Server address must be a site root (no sub-folder, credentials, query or fragment), e.g. https://directory.example.org" }
    return uri
}
val parsedCommunityUrl = siteRoot(communityUrl, false)
siteRoot(communityDebugUrl, true)
fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

// Every build that is shared with members MUST be signed with the same
// permanent key, otherwise phones refuse to install an update over the old
// app. The key is provided through environment variables (GitHub secrets in
// CI; see docs/ANDROID_RELEASE.md). It is never stored in the repository.
val keystoreFile = System.getenv("MVPMI_KEYSTORE_FILE")?.takeIf { it.isNotBlank() }

android {
    namespace = "org.mvpmi.directory"
    compileSdk = 36
    defaultConfig {
        applicationId = "org.mvpmi.directory"
        // Android 10 (API 29) to Android 17.
        minSdk = 29
        targetSdk = 36
        // CI passes a growing number (-PversionCode=<run number>) so every
        // new APK installs as an update.
        versionCode = providers.gradleProperty("versionCode").orElse("9").get().toInt()
        // CI passes the release tag (v1.0.0 → 1.0.0).
        versionName = providers.gradleProperty("versionName").orElse("1.0.0").get()
        // Instrumented tests on an emulator/phone (android/app/src/androidTest,
        // modelled on github.com/android/testing-samples). See
        // docs/ANDROID_DEVICE_TESTS.md.
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    signingConfigs {
        if (keystoreFile != null) {
            create("release") {
                storeFile = file(keystoreFile)
                storePassword = System.getenv("MVPMI_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("MVPMI_KEY_ALIAS")
                keyPassword = System.getenv("MVPMI_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("debug") {
            buildConfigField("String", "COMMUNITY_URL", quoted(communityDebugUrl))
        }
        getByName("release") {
            buildConfigField("String", "COMMUNITY_URL", quoted(communityUrl))
            isDebuggable = false
            isMinifyEnabled = false
            if (keystoreFile != null) signingConfig = signingConfigs.getByName("release")
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:core:1.6.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test:rules:1.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.test.espresso:espresso-web:3.6.1")
    androidTestImplementation("androidx.test.espresso:espresso-intents:3.6.1")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
}

// A release build needs a real server address and the permanent signing key.
val verifyReleaseReadiness by tasks.registering {
    doLast {
        if (parsedCommunityUrl.host == "example.invalid")
            throw GradleException("Release build needs your hosted address: -PcommunityUrl=https://your-domain")
        if (keystoreFile == null)
            throw GradleException("Release build needs the permanent signing key (MVPMI_KEYSTORE_FILE and passwords). See docs/ANDROID_RELEASE.md.")
    }
}
tasks.configureEach {
    if (name == "assembleRelease" || name == "bundleRelease") dependsOn(verifyReleaseReadiness)
}
