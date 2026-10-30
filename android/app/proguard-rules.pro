# Release builds are shrunk with R8 (owner, 30 Oct 2026): the APK went from
# about 42 MB to a few MB, so installs and updates download much faster.
# Names are not obfuscated (crash reports stay readable; the app is small).
-dontobfuscate
# Our own code stays whole (MainActivity, the JavaScript bridge, workers).
-keep class org.mvpmi.directory.** { *; }
# Methods the web page calls through the WebView bridge.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface,*Annotation*,SourceFile,LineNumberTable
