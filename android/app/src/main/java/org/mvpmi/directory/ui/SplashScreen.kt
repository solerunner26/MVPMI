package org.mvpmi.directory.ui

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.SupportAgent
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.mvpmi.directory.R

/** What the splash shows (cached from the last session; never phone numbers). */
data class SplashInfo(
    val villageGu: String = "",
    val villageEn: String = "",
    val villageMembers: Int = 0,
    val totalMembers: Int = 0,
    val gujarati: Boolean = true,
)

/**
 * Splash screen shown every time the app starts. The person enters with
 * "Enter Directory"; meanwhile the directory loads underneath.
 * Layout follows the owner's sample: arched devotional image, the sun (the
 * community's holy symbol) as a medallion, one-line community name, three
 * numbers, the Enter button, admin contacts and the blessing line.
 */
@Composable
fun SplashScreen(info: SplashInfo, colors: ShellColors, onEnter: () -> Unit, onContactAdmins: () -> Unit) {
    val gu = info.gujarati
    fun l(g: String, e: String) = if (gu) g else e
    val context = LocalContext.current
    val motionOn = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    }
    // Entrance: the card rises on a spring; the sun scales in after it.
    val rise = remember { Animatable(if (motionOn) 1f else 0f) }
    val sunIn = remember { Animatable(if (motionOn) 0f else 1f) }
    LaunchedEffect(Unit) {
        rise.animateTo(0f, ShellMotion.spatial())
        sunIn.animateTo(1f, ShellMotion.spatialFast())
    }
    val spin = rememberInfiniteTransition(label = "sun")
    val angle by spin.animateFloat(0f, 360f, infiniteRepeatable(tween(90_000, easing = LinearEasing), RepeatMode.Restart), label = "angle")
    val glow by spin.animateFloat(0.35f, 0.75f, infiniteRepeatable(tween(2400), RepeatMode.Reverse), label = "glow")

    Box(
        Modifier
            .fillMaxSize()
            .background(colors.page)
            .drawBehind {
                drawRect(Brush.radialGradient(listOf(colors.pageGlow, Color.Transparent), center = Offset(size.width * 0.2f, 0f), radius = size.maxDimension * 0.8f))
                drawRect(Brush.radialGradient(listOf(colors.saffron.copy(alpha = 0.18f), Color.Transparent), center = Offset(size.width * 0.9f, size.height), radius = size.maxDimension * 0.6f))
            }
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .testTag("splash_screen"),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .widthIn(max = 440.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .graphicsLayer {
                    translationY = rise.value * 60.dp.toPx()
                    alpha = 1f - rise.value
                }
                .shadow(28.dp, RoundedCornerShape(32.dp), ambientColor = colors.shadow, spotColor = colors.shadow)
                .clip(RoundedCornerShape(32.dp))
                .background(colors.card)
                .border(1.dp, Brush.verticalGradient(listOf(colors.saffron.copy(alpha = 0.45f), Color.Transparent)), RoundedCornerShape(32.dp))
                .padding(horizontal = 18.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // ---- Arched devotional image with the sun medallion on its base.
            Box(Modifier.fillMaxWidth(0.86f), contentAlignment = Alignment.BottomCenter) {
                val arch = RoundedCornerShape(topStartPercent = 50, topEndPercent = 50, bottomStartPercent = 9, bottomEndPercent = 9)
                Box(
                    Modifier
                        .fillMaxWidth()
                        .aspectRatio(0.80f)
                        .drawBehind {
                            drawRect(Brush.radialGradient(listOf(colors.saffron.copy(alpha = glow * 0.55f), Color.Transparent), center = Offset(size.width / 2, size.height * 0.35f), radius = size.width * 0.75f))
                        }
                        .padding(6.dp)
                        .shadow(18.dp, arch, ambientColor = colors.brand, spotColor = colors.brand)
                        .clip(arch)
                        .border(3.dp, colors.goldRing, arch),
                ) {
                    Image(
                        painter = painterResource(R.drawable.splash_deity),
                        contentDescription = l("માતાજી", "Mataji"),
                        contentScale = ContentScale.Crop,
                        alignment = Alignment.TopCenter,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                Box(
                    Modifier
                        .offset(y = 34.dp)
                        .size(72.dp)
                        .graphicsLayer { scaleX = sunIn.value; scaleY = sunIn.value }
                        .shadow(16.dp, CircleShape, ambientColor = colors.saffron, spotColor = colors.saffron)
                        .clip(CircleShape)
                        .background(colors.card)
                        .border(3.dp, colors.goldRing, CircleShape)
                        .padding(6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(
                        painter = painterResource(R.drawable.sun_medallion),
                        contentDescription = l("સૂર્ય — સમાજનું પવિત્ર પ્રતીક", "Sun — the community's holy symbol"),
                        modifier = Modifier.fillMaxSize().clip(CircleShape).rotate(if (motionOn) angle else 0f),
                    )
                }
            }
            Spacer(Modifier.height(48.dp))

            // ---- Community name: ONE line in both languages (auto-size).
            BasicText(
                text = l("મહુવા ક્ષત્રિય રાજપૂત સમાજ", "Mahuva Kshatriya Rajput Samaj"),
                maxLines = 1,
                overflow = TextOverflow.Clip,
                style = TextStyle(color = colors.ink, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center),
                autoSize = TextAutoSize.StepBased(minFontSize = 14.sp, maxFontSize = 26.sp, stepSize = 0.5.sp),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                l("ભાવનગર જિલ્લો • સંગઠન, સંસ્કાર અને સેવા", "Bhavnagar district • Unity, culture and service"),
                color = colors.ink2, fontSize = 13.sp, textAlign = TextAlign.Center, maxLines = 2,
            )
            Spacer(Modifier.height(16.dp))

            // ---- Numbers (cached from the last visit).
            if (info.totalMembers > 0) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatPill(l("ગામનું નામ", "Village"), (if (gu) info.villageGu else info.villageEn).ifBlank { "—" }, colors, Modifier.weight(1f))
                    StatPill(l("સભ્યો", "Members"), info.villageMembers.toString(), colors, Modifier.weight(1f))
                    StatPill(l("કુલ સભ્યો", "Total members"), info.totalMembers.toString(), colors, Modifier.weight(1f))
                }
                Spacer(Modifier.height(18.dp))
            } else Spacer(Modifier.height(6.dp))

            // ---- Enter Directory: the only way in.
            EnterButton(l("પ્રવેશ કરો • Enter Directory", "Enter Directory • પ્રવેશ કરો"), colors, onEnter)
            Spacer(Modifier.height(12.dp))

            // ---- Admin contacts.
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(colors.chip)
                    .heightIn(min = 48.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ContactChip(Icons.Rounded.SupportAgent, l("મુખ્ય એડમિન", "Main Admin"), colors, Modifier.weight(1f).testTag("splash_main_admin"), onContactAdmins)
                Box(Modifier.width(1.dp).height(24.dp).background(colors.ink2.copy(alpha = 0.2f)))
                ContactChip(Icons.Rounded.Call, l("ગામના એડમિન", "Village Admin"), colors, Modifier.weight(1f).testTag("splash_village_admin"), onContactAdmins)
            }
            Spacer(Modifier.height(14.dp))
            Text(
                "જય ભવાની • જય માતાજી • સર્વે ભવન્તુ સુખિનઃ",
                color = colors.ink2, fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 1,
            )
        }
    }
}

@Composable
private fun StatPill(label: String, value: String, colors: ShellColors, modifier: Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(20.dp))
            .background(colors.chip)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, color = colors.brand, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(2.dp))
        Text(value, color = colors.ink, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun EnterButton(text: String, colors: ShellColors, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.96f else 1f, ShellMotion.spatialFast(), label = "press")
    Row(
        Modifier
            .fillMaxWidth()
            .height(58.dp)
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .shadow(14.dp, RoundedCornerShape(29.dp), ambientColor = colors.brand, spotColor = colors.brand)
            .clip(RoundedCornerShape(29.dp))
            .background(colors.brandGradient)
            .border(1.dp, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.5f), Color.Transparent)), RoundedCornerShape(29.dp))
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick)
            .testTag("splash_enter"),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.width(10.dp))
        Icon(Icons.AutoMirrored.Rounded.ArrowForward, contentDescription = null, tint = Color.White)
    }
}

@Composable
private fun ContactChip(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, colors: ShellColors, modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .heightIn(min = 48.dp)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = colors.brand, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, color = colors.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
