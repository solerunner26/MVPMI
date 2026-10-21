package org.mvpmi.directory.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.clickable
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.interaction.MutableInteractionSource
import org.mvpmi.directory.R

/** State of the must-update page (null in MainActivity = no update needed). */
@Immutable
data class UpdateUi(
    val version: String = "",
    val build: Int = 0,
    /** null = not started; 0..1 downloading; -1 = downloading, size unknown. */
    val progress: Float? = null,
    /** Download finished; waiting for Android's Install screen. */
    val ready: Boolean = false,
    val needsPermission: Boolean = false,
    val failed: Boolean = false,
)

/**
 * Full-screen, cannot be skipped: the old version is blocked until the new
 * one is installed. One big button; Android itself asks "Install?".
 */
@Composable
fun UpdateScreen(ui: UpdateUi, gujarati: Boolean, colors: ShellColors, onUpdate: () -> Unit) {
    val gu = gujarati
    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(colors.pageGlow, colors.page)))
            // Swallow every touch so nothing underneath can be used.
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
            .semantics { testTag = "update_screen" }
            .windowInsetsPadding(WindowInsets.systemBars)
            .padding(28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Image(painterResource(R.drawable.sun_medallion), contentDescription = null, modifier = Modifier.size(120.dp))
            Text(
                if (gu) "નવું અપડેટ આવ્યું છે" else "A new update is ready",
                color = colors.ink, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center,
            )
            Text(
                if (gu) "એપ વાપરવા માટે નવી આવૃત્તિ ઇન્સ્ટોલ કરો. તમારું લોગિન અને માહિતી એમ જ રહેશે."
                else "Install the new version to keep using the app. Your login and details stay as they are.",
                color = colors.ink2, fontSize = 17.sp, textAlign = TextAlign.Center, lineHeight = 24.sp,
            )
            if (ui.version.isNotBlank() || ui.build > 0)
                Text(
                    (if (gu) "આવૃત્તિ " else "Version ") + ui.version.removePrefix("v") + (if (ui.build > 0) (if (gu) " · બિલ્ડ " else " · Build ") + ui.build else ""),
                    color = colors.ink2, fontSize = 14.sp,
                )
            Spacer(Modifier.height(6.dp))
            val p = ui.progress
            if (p != null && !ui.ready && !ui.failed) {
                if (p >= 0f)
                    LinearProgressIndicator(progress = { p }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(8.dp)), color = colors.brand)
                else
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(8.dp)), color = colors.brand)
                Text(
                    (if (gu) "ડાઉનલોડ થાય છે" else "Downloading") + if (p >= 0f) " · ${(p * 100).toInt()}%" else "…",
                    color = colors.ink2, fontSize = 15.sp,
                )
            } else {
                if (ui.failed)
                    Text(
                        if (gu) "ડાઉનલોડ ન થયું. ઇન્ટરનેટ તપાસીને ફરી પ્રયાસ કરો." else "The download did not finish. Check the internet and try again.",
                        color = colors.brand, fontSize = 15.sp, textAlign = TextAlign.Center,
                    )
                if (ui.needsPermission)
                    Text(
                        if (gu) "ફોન પૂછે ત્યારે «આ સ્રોતમાંથી મંજૂરી આપો» ચાલુ કરો, પછી પાછા આવો."
                        else "When the phone asks, turn on “Allow from this source”, then come back.",
                        color = colors.ink2, fontSize = 15.sp, textAlign = TextAlign.Center,
                    )
                Button(
                    onClick = onUpdate,
                    modifier = Modifier.fillMaxWidth().height(58.dp).semantics { testTag = "update_now" },
                    shape = RoundedCornerShape(29.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = colors.brand),
                ) {
                    Text(
                        when {
                            ui.ready -> if (gu) "ઇન્સ્ટોલ કરો" else "Install"
                            ui.failed -> if (gu) "ફરી પ્રયાસ કરો" else "Try again"
                            else -> if (gu) "હમણાં અપડેટ કરો" else "Update now"
                        },
                        fontSize = 18.sp, fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}
