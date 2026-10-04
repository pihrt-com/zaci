<?php

$SECRET = "your pass";

$clientSecret = $_SERVER["HTTP_X_DOCHAZKA_SECRET"] ?? null;

if ($clientSecret !== $SECRET) {
    http_response_code(403);
    echo "Forbidden";
    exit;
}

$raw = file_get_contents("php://input");

if (!$raw) {
    http_response_code(400);
    echo "No data";
    exit;
}

$data = json_decode($raw, true);

if ($data === null) {
    http_response_code(400);
    echo "Invalid JSON";
    exit;
}

/* === přidáme timestamp === */
$data["generated_at"] = date("c"); // ISO 8601

$json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

file_put_contents(__DIR__ . "/data/status.json", $json);

echo "OK";
