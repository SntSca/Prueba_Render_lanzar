package com.example.usersbe.services;

import org.springframework.stereotype.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CaptchaService {

    private static final int CODE_LEN = 6;
    private static final int EXPIRE_SECONDS = 120;

    private static final int IMG_W = 220;
    private static final int IMG_H = 60;

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final Font CODE_FONT = new Font("Arial", Font.BOLD, 40);

    private static final int NOISE_LINES = 22;
    private static final int NOISE_DOTS  = 160;

    private static final Color BG_COLOR = new Color(28, 28, 28);
    private static final Color FG_COLOR = new Color(240, 240, 240);

    private static class Entry {
        final String code;
        final Instant expiresAt;
        final String userId; 

        Entry(String code, Instant expiresAt, String userId) {
            this.code = code;
            this.expiresAt = expiresAt;
            this.userId = userId;
        }

        boolean expired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    private final Map<String, Entry> store = new ConcurrentHashMap<>();
    private static final SecureRandom RND = new SecureRandom();

    public static class CaptchaPayload {
        public final String token;
        public final String imageBase64;

        CaptchaPayload(String token, String imageBase64) {
            this.token = token;
            this.imageBase64 = imageBase64;
        }
    }

    public CaptchaPayload generate() {
        return generate(null);
    }

    public CaptchaPayload generate(String userId) {
        cleanupExpired();
        final String code  = randomCode(CODE_LEN);
        final String token = UUID.randomUUID().toString();

        store.put(token, new Entry(code, Instant.now().plusSeconds(EXPIRE_SECONDS), userId));

        final String b64 = renderPngBase64(code);
        return new CaptchaPayload(token, b64);
    }

    public String verifyAndConsumeReturnUserId(String token, String answer) {
        cleanupExpired();
        if (token == null || answer == null) return null;

        final Entry e = store.get(token);
        if (e == null || e.expired()) return null;

        final String user = answer.trim();
        if (!e.code.equalsIgnoreCase(user)) {
            return null; 
        }

        store.remove(token);
        return e.userId;
    }

    public CaptchaPayload rotate(String oldToken) {
        cleanupExpired();

        String userId = null;
        if (oldToken != null) {
            final Entry old = store.remove(oldToken); 
            if (old != null) {
                userId = old.userId; 
            }
        }
        return generate(userId);
    }

    public String getUserId(String token) {
        cleanupExpired();
        if (token == null) return null;
        final Entry e = store.get(token);
        return (e == null || e.expired()) ? null : e.userId;
    }

    private void cleanupExpired() {
        final Instant now = Instant.now();
        store.entrySet().removeIf(en -> en.getValue() == null || now.isAfter(en.getValue().expiresAt));
    }

    private String randomCode(int len) {
        final StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(ALPHABET.charAt(RND.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    private String renderPngBase64(String code) {
        try {
            final BufferedImage captchaImg = new BufferedImage(IMG_W, IMG_H, BufferedImage.TYPE_INT_RGB);
            final Graphics2D g = captchaImg.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

                g.setColor(BG_COLOR);
                g.fillRect(0, 0, IMG_W, IMG_H);

                for (int i = 0; i < NOISE_LINES; i++) {
                    g.setColor(new Color(80 + RND.nextInt(100), 80 + RND.nextInt(100), 80 + RND.nextInt(100)));
                    int x1 = RND.nextInt(IMG_W);
                    int y1 = RND.nextInt(IMG_H);
                    int x2 = RND.nextInt(IMG_W);
                    int y2 = RND.nextInt(IMG_H);
                    g.drawLine(x1, y1, x2, y2);
                }

                g.setFont(CODE_FONT);
                g.setColor(FG_COLOR);
                final FontMetrics fm = g.getFontMetrics();
                int x = 20;
                final int baseline = (IMG_H - fm.getHeight()) / 2 + fm.getAscent();

                for (char ch : code.toCharArray()) {
                    final AffineTransform old = g.getTransform();
                    final double angle = (RND.nextDouble() - 0.5) * 0.3;
                    final double scale = 0.9 + RND.nextDouble() * 0.2;
                    g.rotate(angle, x, baseline);
                    g.scale(scale, scale);
                    g.drawString(String.valueOf(ch), x, baseline);
                    g.setTransform(old);
                    x += fm.charWidth(ch) + 5;
                }

                for (int i = 0; i < NOISE_DOTS; i++) {
                    int px = RND.nextInt(IMG_W);
                    int py = RND.nextInt(IMG_H);
                    g.setColor(new Color(60 + RND.nextInt(140), 60 + RND.nextInt(140), 60 + RND.nextInt(140)));
                    g.fillRect(px, py, 1, 1);
                }
            } finally {
                g.dispose();
            }

            int qrSize = IMG_H; 
            QRCodeWriter qrWriter = new QRCodeWriter();
            EnumMap<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.MARGIN, 1);
            BitMatrix matrix = qrWriter.encode(code, BarcodeFormat.QR_CODE, qrSize, qrSize, hints);
            BufferedImage qrImg = MatrixToImageWriter.toBufferedImage(matrix);

            int totalWidth = IMG_W + qrSize + 10; 
            BufferedImage combined = new BufferedImage(totalWidth, IMG_H, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2 = combined.createGraphics();
            try {
                g2.setColor(BG_COLOR);
                g2.fillRect(0, 0, totalWidth, IMG_H);
                g2.drawImage(captchaImg, 0, 0, null);
                g2.drawImage(qrImg, IMG_W + 10, 0, null);
            } finally {
                g2.dispose();
            }

            try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                ImageIO.write(combined, "png", baos);
                return "data:image/png;base64," + Base64.getEncoder().encodeToString(baos.toByteArray());
            }
        } catch (WriterException | java.io.IOException e) {
            throw new IllegalStateException("Error generando CAPTCHA + QR", e);
        }
    }
}
