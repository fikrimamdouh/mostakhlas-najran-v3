package com.fikry.assistant;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private static final int VOICE_REQUEST = 1001;
    private static final String PREFS = "fikry_assistant_settings";

    private SharedPreferences prefs;
    private TextToSpeech tts;
    private boolean ttsReady;
    private TextView resultText;
    private TextView connectionStatus;
    private EditText commandInput;
    private Button micButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(16, 36, 62));
        getWindow().setNavigationBarColor(Color.rgb(16, 36, 62));
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        tts = new TextToSpeech(this, this);
        resultText = findViewById(R.id.resultText);
        connectionStatus = findViewById(R.id.connectionStatus);
        commandInput = findViewById(R.id.commandInput);
        micButton = findViewById(R.id.micButton);

        micButton.setOnClickListener(v -> startVoice());
        findViewById(R.id.sendButton).setOnClickListener(v -> {
            String command = commandInput.getText().toString().trim();
            if (!command.isEmpty()) {
                commandInput.setText("");
                route(command);
            }
        });
        findViewById(R.id.extractButton).setOnClickListener(v -> route("راجع حالة المستخلص الحالي"));
        findViewById(R.id.factoryButton).setOnClickListener(v -> route("اعمل ملخص المصنع اليوم"));
        findViewById(R.id.fuelButton).setOnClickListener(v -> route("شوف تقرير الديزل"));
        findViewById(R.id.emailButton).setOnClickListener(v -> openEmail());
        findViewById(R.id.calendarButton).setOnClickListener(v -> openCalendar());
        findViewById(R.id.settingsButton).setOnClickListener(v -> showSettings());

        updateConnectionStatus();
        if (savedInstanceState == null && prefs.getBoolean("autoListen", true)) {
            resultText.postDelayed(this::startVoice, 900);
        }
    }

    private void startVoice() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "اتكلم يا فكري");
        try {
            micButton.setText("أستمع الآن...");
            startActivityForResult(intent, VOICE_REQUEST);
        } catch (ActivityNotFoundException error) {
            micButton.setText("ابدأ الكلام");
            show("خدمة التعرف على الصوت غير متاحة. استخدم الكتابة أو فعّل تطبيق Google.", true);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        micButton.setText("ابدأ الكلام");
        if (requestCode == VOICE_REQUEST && resultCode == RESULT_OK && data != null) {
            ArrayList<String> list = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (list != null && !list.isEmpty()) route(list.get(0));
        }
    }

    private void route(String original) {
        String command = normalize(original);
        if (has(command, "البريد", "جيميل", "gmail")) {
            show("فتحت البريد.", true);
            openEmail();
        } else if (has(command, "تقويم", "مواعيد", "موعد", "calendar")) {
            show("فتحت التقويم.", true);
            openCalendar();
        } else if (has(command, "اعدادات", "ربط", "api")) {
            showSettings();
        } else if (has(command, "مستخلص", "توقيع", "موقع ناقص")) {
            callApi("/api/assistant/extract-summary", "حالة المستخلص",
                    "وضع تجريبي — برنامج المستخلصات غير مربوط بعد. بعد إضافة عنوان API سيعرض حالة المستخلص والمواقع والتوقيعات والفرق المالي الفعلي.");
        } else if (has(command, "ديزل", "وقود", "بنزين")) {
            callApi("/api/assistant/fuel-status", "تقرير الوقود",
                    "وضع تجريبي — تقرير الديزل غير مربوط بعد. عند الربط سيعرض آخر تشغيل والحركات واللترات والمبلغ ورصيد الخزنة.");
        } else if (has(command, "عميل", "رصيد", "محفظه", "محفظة")) {
            callApi("/api/assistant/customer-audit", "مراجعة العميل",
                    "وضع تجريبي — مراجعة العملاء غير مربوطة بعد. عند الربط سيطابق الفواتير والسداد والبنوك وإشعارات العملاء.");
        } else if (has(command, "مصنع", "erp", "مبيعات", "تحصيلات", "تقرير امس", "تقرير اليوم")) {
            callApi("/api/assistant/factory-summary", "ملخص المصنع",
                    "وضع تجريبي — مصنع بن حامد غير مربوط بعد. عند الربط سيعرض تقرير ERP والمبيعات والتحصيلات والخرسانة والبلوك والأخطاء.");
        } else {
            show("سمعت: " + original + "\n\nجرّب: راجع المستخلص، شوف الديزل، اعمل ملخص المصنع، راجع رصيد عميل، افتح البريد، أو افتح التقويم.", true);
        }
    }

    private void callApi(String path, String title, String demo) {
        String base = prefs.getString("baseUrl", "").trim();
        if (base.isEmpty()) {
            show(title + "\n\n" + demo, true);
            return;
        }
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        final String endpoint = base + path;
        show("جاري قراءة " + title + "...", false);

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(18000);
                connection.setRequestProperty("Accept", "application/json");
                String token = prefs.getString("accessToken", "").trim();
                if (!token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);

                int status = connection.getResponseCode();
                InputStream stream = status >= 200 && status < 300
                        ? connection.getInputStream() : connection.getErrorStream();
                String body = read(stream);
                if (status < 200 || status >= 300) throw new Exception("حالة الخادم: " + status + "\n" + body);

                String message = parse(body);
                runOnUiThread(() -> show(title + "\n\n" + message, true));
            } catch (Exception error) {
                String message = "تعذر الاتصال بالنظام.\n\n" + error.getMessage()
                        + "\n\nراجع عنوان API ورمز الوصول من الإعدادات.";
                runOnUiThread(() -> show(message, true));
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private String read(InputStream stream) throws Exception {
        if (stream == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder text = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) text.append(line).append('\n');
        reader.close();
        return text.toString().trim();
    }

    private String parse(String body) {
        try {
            JSONObject json = new JSONObject(body);
            if (json.has("message")) return json.optString("message");
            if (json.has("summary")) return json.optString("summary");
            return json.toString(2);
        } catch (Exception ignored) {
            return body.isEmpty() ? "وصل رد فارغ من الخادم." : body;
        }
    }

    private void showSettings() {
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(20, 8, 20, 0);
        form.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        EditText baseUrl = new EditText(this);
        baseUrl.setHint("https://example.com");
        baseUrl.setText(prefs.getString("baseUrl", ""));
        baseUrl.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        baseUrl.setGravity(Gravity.RIGHT);

        EditText token = new EditText(this);
        token.setHint("رمز الوصول — اختياري");
        token.setText(prefs.getString("accessToken", ""));
        token.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        token.setGravity(Gravity.RIGHT);

        CheckBox autoListen = new CheckBox(this);
        autoListen.setText("ابدأ الاستماع تلقائيًا عند فتح التطبيق");
        autoListen.setChecked(prefs.getBoolean("autoListen", true));

        CheckBox voiceReply = new CheckBox(this);
        voiceReply.setText("اقرأ النتيجة بصوت مرتفع");
        voiceReply.setChecked(prefs.getBoolean("voiceReply", true));

        TextView baseLabel = new TextView(this);
        baseLabel.setText("عنوان API الآمن");
        baseLabel.setGravity(Gravity.RIGHT);
        TextView tokenLabel = new TextView(this);
        tokenLabel.setText("رمز الوصول");
        tokenLabel.setGravity(Gravity.RIGHT);

        form.addView(baseLabel);
        form.addView(baseUrl);
        form.addView(tokenLabel);
        form.addView(token);
        form.addView(autoListen);
        form.addView(voiceReply);

        new AlertDialog.Builder(this)
                .setTitle("إعدادات مساعد فكري")
                .setView(form)
                .setPositiveButton("حفظ", (dialog, which) -> {
                    prefs.edit()
                            .putString("baseUrl", baseUrl.getText().toString().trim())
                            .putString("accessToken", token.getText().toString().trim())
                            .putBoolean("autoListen", autoListen.isChecked())
                            .putBoolean("voiceReply", voiceReply.isChecked())
                            .apply();
                    updateConnectionStatus();
                    show("تم حفظ الإعدادات على الهاتف.", true);
                })
                .setNegativeButton("إلغاء", null)
                .setNeutralButton("مسح الربط", (dialog, which) -> {
                    prefs.edit().remove("baseUrl").remove("accessToken").apply();
                    updateConnectionStatus();
                    show("تم مسح الربط وعاد التطبيق إلى الوضع التجريبي.", true);
                })
                .show();
    }

    private void updateConnectionStatus() {
        boolean connected = !prefs.getString("baseUrl", "").trim().isEmpty();
        connectionStatus.setText(connected ? "متصل بعنوان API" : "الوضع التجريبي");
        connectionStatus.setBackgroundColor(connected ? Color.rgb(43, 139, 95) : Color.rgb(107, 124, 143));
    }

    private void openEmail() {
        Intent gmail = getPackageManager().getLaunchIntentForPackage("com.google.android.gm");
        try {
            if (gmail != null) startActivity(gmail);
            else {
                Intent email = new Intent(Intent.ACTION_MAIN);
                email.addCategory(Intent.CATEGORY_APP_EMAIL);
                startActivity(email);
            }
        } catch (ActivityNotFoundException error) {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://mail.google.com")));
        }
    }

    private void openCalendar() {
        Intent calendar = new Intent(Intent.ACTION_VIEW,
                CalendarContract.CONTENT_URI.buildUpon().appendPath("time").build());
        try {
            startActivity(calendar);
        } catch (ActivityNotFoundException error) {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://calendar.google.com")));
        }
    }

    private void show(String message, boolean speak) {
        resultText.setText(message);
        if (speak && ttsReady && prefs.getBoolean("voiceReply", true)) {
            tts.speak(message.replace("وضع تجريبي — ", "هذه نتيجة تجريبية. "),
                    TextToSpeech.QUEUE_FLUSH, null, "fikry_reply");
        }
    }

    private String normalize(String text) {
        return text.toLowerCase(Locale.ROOT)
                .replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي')
                .replace("ـ", "").trim();
    }

    private boolean has(String source, String... words) {
        for (String word : words) if (source.contains(normalize(word))) return true;
        return false;
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(new Locale("ar", "SA"));
            tts.setSpeechRate(0.92f);
            ttsReady = result != TextToSpeech.LANG_MISSING_DATA
                    && result != TextToSpeech.LANG_NOT_SUPPORTED;
        }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        super.onDestroy();
    }
}
