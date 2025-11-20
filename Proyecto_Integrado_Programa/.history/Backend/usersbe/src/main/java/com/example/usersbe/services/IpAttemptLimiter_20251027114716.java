package com.example.usersbe.services;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class IpAttemptLimiter {

    private static final Logger log = LoggerFactory.getLogger(IpAttemptLimiter.class);

    private final File logFile;
    private final int maxAttempts;
    private final long windowMs;

    public IpAttemptLimiter(
            @Value("${security.login.logFile:logs/login-fail.log}") String logPath,
            @Value("${security.login.maxAttempts:5}") int maxAttempts,
            @Value("${security.login.windowSeconds:300}") long windowSeconds) {
        this.logFile = new File(System.getProperty("java.io.tmpdir"), logPath);
        this.maxAttempts = maxAttempts;
        this.windowMs = windowSeconds * 1000L;
    }

    public synchronized void logFailure(String ip) {
        try {
            File parent = logFile.getParentFile();
            if (parent != null) {
                parent.mkdirs();
            }
            try (BufferedWriter bw = Files.newBufferedWriter(
                    logFile.toPath(),
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND)) {
                bw.write(Long.toString(System.currentTimeMillis()));
                bw.write('|');
                bw.write(ip);
                bw.newLine();
            }
        } catch (IOException e) {
            log.warn("No se pudo escribir en el log de intentos ({}): {}", logFile.getPath(), e.toString());
        }
    }

    public synchronized int countRecent(String ip) {
        if (!logFile.exists()) {
            return 0;
        }
        long now = System.currentTimeMillis();
        int count = 0;

        try (BufferedReader br = Files.newBufferedReader(logFile.toPath(), StandardCharsets.UTF_8)) {
            String line;
            while ((line = br.readLine()) != null) {
                int sep = line.indexOf('|');
                if (sep <= 0) {
                    continue;
                }
                long ts = parseTs(line.substring(0, sep));
                if (ts > 0 && (now - ts) <= windowMs) {
                    String lineIp = line.substring(sep + 1);
                    if (ip.equals(lineIp)) {
                        count++;
                    }
                }
            }
        } catch (IOException e) {
            log.warn("No se pudo leer el log de intentos ({}): {}", logFile.getPath(), e.toString());
            return 0;
        }
        return count;
    }

    public synchronized boolean blocked(String ip) {
        return countRecent(ip) >= maxAttempts;
    }

    public synchronized long secondsToUnlock(String ip) {
        if (!logFile.exists()) {
            return 0L;
        }
        long now = System.currentTimeMillis();
        long oldestInside = Long.MAX_VALUE;
        int count = 0;

        try (BufferedReader br = Files.newBufferedReader(logFile.toPath(), StandardCharsets.UTF_8)) {
            String line;
            while ((line = br.readLine()) != null) {
                int sep = line.indexOf('|');
                if (sep <= 0) {
                    continue;
                }
                long ts = parseTs(line.substring(0, sep));
                if (ts <= 0 || (now - ts) > windowMs) {
                    continue;
                }
                String lineIp = line.substring(sep + 1);
                if (!ip.equals(lineIp)) {
                    continue;
                }
                count++;
                if (ts < oldestInside) {
                    oldestInside = ts;
                }
            }
        } catch (IOException e) {
            log.warn("No se pudo calcular el desbloqueo ({}): {}", logFile.getPath(), e.toString());
            return 0L;
        }

        if (count < maxAttempts) {
            return 0L;
        }
        long unlockAt = oldestInside + windowMs;
        long seconds = (unlockAt - now + 999) / 1000;
        return Math.max(seconds, 0L);
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    private static long parseTs(String s) {
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException ex) {
            return -1L;
        }
    }
}
