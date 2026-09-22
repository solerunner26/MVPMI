import java.net.URI

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
val communityUrl = providers.gradleProperty("communityUrl").orElse("https://example.invalid").get()
val parsedCommunityUrl = URI(communityUrl)
require(parsedCommunityUrl.scheme == "https" && parsedCommunityUrl.host != null && parsedCommunityUrl.rawUserInfo == null && parsedCommunityUrl.rawQuery == null && parsedCommunityUrl.rawFragment == null) { "communityUrl must be a valid HTTPS server URL without credentials, query or fragment" }
android {
    namespace = "org.mvpmi.directory"
    compileSdk = 36
    defaultConfig {
        applicationId = "org.mvpmi.directory"
        minSdk = 21
        targetSdk = 36
        versionCode = 8
        versionName = "0.3.4-dev"
        buildConfigField("String", "COMMUNITY_URL", "\"${communityUrl.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies { testImplementation("junit:junit:4.13.2") }

// This host is deliberately not publishable until the documented blockers are resolved.
val verifyReleaseReadiness by tasks.registering {
    doLast {
        throw GradleException("Release blocked: member identity/recovery, privacy deletion, native exports and Android device validation are incomplete. See docs/RELEASE_AUDIT.md.")
    }
}
tasks.configureEach {
    if (name == "assembleRelease" || name == "bundleRelease") dependsOn(verifyReleaseReadiness)
}
