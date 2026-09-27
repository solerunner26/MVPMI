import java.net.URI

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

// The hosted server address is built into the app, e.g.
//   gradle assembleRelease -PcommunityUrl=https://directory.example.org
// It must be the ROOT of an HTTPS site (a sub-domain is fine, a sub-folder
// such as https://example.org/directory is not: the web app uses /api paths).
val communityUrl = providers.gradleProperty("communityUrl").orElse("https://example.invalid").get().trimEnd('/')
val parsedCommunityUrl = URI(communityUrl)
require(
    parsedCommunityUrl.scheme == "https" && parsedCommunityUrl.host != null &&
        parsedCommunityUrl.rawUserInfo == null && parsedCommunityUrl.rawQuery == null &&
        parsedCommunityUrl.rawFragment == null && parsedCommunityUrl.rawPath.isNullOrEmpty(),
) { "communityUrl must be an HTTPS site root (no sub-folder, credentials, query or fragment), e.g. https://directory.example.org" }

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
        minSdk = 21
        targetSdk = 36
        // CI passes a growing number (-PversionCode=<run number>) so every
        // new APK installs as an update.
        versionCode = providers.gradleProperty("versionCode").orElse("9").get().toInt()
        // CI passes the release tag (v1.0.0 → 1.0.0).
        versionName = providers.gradleProperty("versionName").orElse("1.0.0").get()
        buildConfigField("String", "COMMUNITY_URL", "\"${communityUrl.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
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
        getByName("release") {
            isDebuggable = false
            isMinifyEnabled = false
            if (keystoreFile != null) signingConfig = signingConfigs.getByName("release")
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies { testImplementation("junit:junit:4.13.2") }

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
