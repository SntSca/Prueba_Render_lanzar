package com.EsiMediaG03.dto;

public record ErrorResponse(int status, String error, String message) {}