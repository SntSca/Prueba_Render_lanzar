package com.EsiMediaG03.dto;

import java.nio.file.Path;

public record StreamingTarget(Path path, long length, String mimeType,
                              boolean externalRedirect, String externalUrl) {

    public static StreamingTarget local(Path path, long length, String mimeType) {
        return new StreamingTarget(path, length, mimeType, false, null);
    }
    public static StreamingTarget external(String url, String mimeType) {
        return new StreamingTarget(null, -1, mimeType, true, url);
    }

    public boolean isExternalRedirect() { return externalRedirect; }
}
