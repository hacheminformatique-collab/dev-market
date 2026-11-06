<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
http_response_code(410);
echo json_encode(['error' => 'La génération OpenAI des pages villes est désactivée. Déployez la version utilisant les modèles locaux.'], JSON_UNESCAPED_UNICODE);
