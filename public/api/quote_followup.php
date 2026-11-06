<?php

function quote_followup_text($value, $maxLength = 500)
{
    if (!is_string($value) && !is_numeric($value)) return '';
    $value = strip_tags((string) $value);
    $value = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value);
    $value = preg_replace('/\s+/u', ' ', trim($value));
    if ($value === null) return '';
    return function_exists('mb_substr') ? mb_substr($value, 0, $maxLength, 'UTF-8') : substr($value, 0, $maxLength);
}

function quote_followup_validate($payload)
{
    if (!is_array($payload) || ($payload['acceptedConditions'] ?? null) !== true) return false;
    $flowId = $payload['flowId'] ?? '';
    $stage = $payload['stage'] ?? null;
    $input = $payload['summary'] ?? null;
    if (!is_string($flowId) || !preg_match('/^[a-f0-9]{32}$/', $flowId)) return false;
    if (!is_int($stage) || $stage < 1 || $stage > 6 || !is_array($input)) return false;

    if (!isset($input['email']) || !is_string($input['email'])) return false;
    $summary = [
        'prenom' => quote_followup_text($input['prenom'] ?? '', 80),
        'nom' => quote_followup_text($input['nom'] ?? '', 80),
        'email' => trim($input['email']),
        'telephone' => quote_followup_text($input['telephone'] ?? '', 40),
        'adresse' => quote_followup_text($input['adresse'] ?? '', 180),
        'codePostal' => quote_followup_text($input['codePostal'] ?? '', 16),
        'ville' => quote_followup_text($input['ville'] ?? '', 80),
    ];
    if ($summary['prenom'] === '' || $summary['nom'] === '' || $summary['telephone'] === '' ||
        !filter_var($summary['email'], FILTER_VALIDATE_EMAIL) || strlen($summary['email']) > 254 ||
        preg_match('/[\r\n]/', $summary['email'])) return false;

    $summary['stage'] = $stage;
    if ($stage >= 2) {
        $summary['typeEvenement'] = quote_followup_text($input['typeEvenement'] ?? '', 80);
        $summary['dateEvenement'] = quote_followup_text($input['dateEvenement'] ?? '', 10);
        $adults = filter_var($input['nbAdultes'] ?? null, FILTER_VALIDATE_INT);
        $children = filter_var($input['nbEnfants'] ?? 0, FILTER_VALIDATE_INT);
        $allowedTypes = ['Anniversaire', 'Babyshower', 'Baptême', 'Fiançaille', 'Mariage', 'Autres'];
        $eventDate = DateTimeImmutable::createFromFormat('!Y-m-d', $summary['dateEvenement']);
        $dateErrors = DateTimeImmutable::getLastErrors();
        if (!in_array($summary['typeEvenement'], $allowedTypes, true) ||
            !$eventDate || ($dateErrors && ($dateErrors['warning_count'] || $dateErrors['error_count'])) ||
            $eventDate->format('Y-m-d') !== $summary['dateEvenement'] ||
            $summary['dateEvenement'] < date('Y-m-d') ||
            $adults === false || $adults < 1 || $adults > 300 ||
            $children === false || $children < 0 || $children > 300 || $adults + $children > 300) return false;
        $summary['nbAdultes'] = $adults;
        $summary['nbEnfants'] = $children;
        $summary['heureDebut'] = quote_followup_text($input['heureDebut'] ?? '', 5);
        $summary['heureFin'] = quote_followup_text($input['heureFin'] ?? '', 5);
        $summary['commentaire'] = quote_followup_text($input['commentaire'] ?? '', 800);
    }

    if ($stage >= 3) {
        $summary['formule'] = quote_followup_text($input['formule'] ?? '', 120);
        if ($summary['formule'] === '') return false;
    }
    $dryFormula = isset($summary['formule']) && stripos($summary['formule'], 'sèche') !== false;
    if ($stage >= 4 && !$dryFormula) {
        $menus = $input['menus'] ?? null;
        if (!is_array($menus) || count($menus) > 20) return false;
        $summary['menus'] = [];
        $sections = [];
        foreach ($menus as $menu) {
            if (!is_array($menu)) return false;
            $section = quote_followup_text($menu['section'] ?? '', 40);
            $name = quote_followup_text($menu['name'] ?? '', 100);
            if ($section === '' || $name === '') return false;
            $summary['menus'][] = ['section' => $section, 'name' => $name];
            $sections[$section] = true;
        }
        foreach (['Entrée', 'Plats', 'Desserts'] as $requiredSection) {
            if (!isset($sections[$requiredSection])) return false;
        }
    }
    if ($stage >= 5 && !$dryFormula) {
        $summary['gateau'] = quote_followup_text($input['gateau'] ?? '', 100);
        if ($summary['gateau'] === '') return false;
        $details = $input['gateauDetails'] ?? null;
        if ($details !== null && !is_array($details)) return false;
        $summary['gateauDetails'] = [];
        foreach (['niv2', 'niv3', 'niv4', 'initiales'] as $key) {
            if (isset($details[$key])) $summary['gateauDetails'][$key] = quote_followup_text($details[$key], 30);
        }
    }
    if ($stage >= 6) {
        $prestations = $input['prestations'] ?? null;
        if (!is_array($prestations) || count($prestations) > 20) return false;
        $summary['prestations'] = [];
        foreach ($prestations as $prestation) {
            $name = quote_followup_text($prestation, 100);
            if ($name === '') return false;
            $summary['prestations'][] = $name;
        }
    }

    return ['flowId' => $flowId, 'stage' => $stage, 'summary' => $summary];
}

function quote_followup_summary_text($summary)
{
    $lines = [
        'Coordonnées : ' . $summary['prenom'] . ' ' . $summary['nom'],
        'E-mail : ' . $summary['email'],
        'Téléphone : ' . $summary['telephone'],
    ];
    if ($summary['adresse'] !== '') $lines[] = 'Adresse : ' . $summary['adresse'];
    if ($summary['codePostal'] !== '' || $summary['ville'] !== '') {
        $lines[] = 'Ville : ' . trim($summary['codePostal'] . ' ' . $summary['ville']);
    }
    if (isset($summary['typeEvenement'])) {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $summary['dateEvenement']);
        $lines[] = 'Événement : ' . $summary['typeEvenement'];
        $lines[] = 'Date : ' . ($date ? $date->format('d/m/Y') : $summary['dateEvenement']);
        $lines[] = 'Participants : ' . ($summary['nbAdultes'] + $summary['nbEnfants']) .
            ' (' . $summary['nbAdultes'] . ' adultes, ' . $summary['nbEnfants'] . ' enfants)';
        if ($summary['heureDebut'] !== '' || $summary['heureFin'] !== '') {
            $lines[] = 'Horaires : ' . $summary['heureDebut'] . ' – ' . $summary['heureFin'];
        }
        if ($summary['commentaire'] !== '') $lines[] = 'Informations complémentaires : ' . $summary['commentaire'];
    }
    if (isset($summary['formule'])) $lines[] = 'Formule : ' . $summary['formule'];
    if (isset($summary['menus'])) {
        $lines[] = 'Menus :';
        foreach ($summary['menus'] as $menu) $lines[] = '- ' . $menu['section'] . ' : ' . $menu['name'];
    }
    if (isset($summary['gateau'])) {
        $lines[] = 'Gâteau : ' . $summary['gateau'];
        foreach ($summary['gateauDetails'] as $key => $value) {
            if ($value !== '') $lines[] = '- ' . ucfirst($key) . ' : ' . $value;
        }
    }
    if (isset($summary['prestations'])) {
        $lines[] = 'Prestations :';
        $lines[] = count($summary['prestations']) ? '- ' . implode("\n- ", $summary['prestations']) : '- Aucune';
    }
    return implode("\n", $lines);
}

function quote_followup_rate_allowed($file, $now = null)
{
    $now = $now ?? time();
    $handle = @fopen($file, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) {
        if ($handle) fclose($handle);
        return false;
    }
    rewind($handle);
    $times = json_decode(stream_get_contents($handle), true);
    if (!is_array($times)) $times = [];
    $times = array_values(array_filter($times, function ($timestamp) use ($now) {
        return is_int($timestamp) && $timestamp > $now - 3600 && $timestamp <= $now;
    }));
    $allowed = count($times) < 120;
    if ($allowed) $times[] = $now;
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($times));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $allowed;
}

function quote_followup_retry_after($file, $now = null)
{
    $now = $now ?? time();
    $times = json_decode(@file_get_contents($file), true);
    if (!is_array($times)) return 3600;
    $times = array_values(array_filter($times, function ($timestamp) use ($now) {
        return is_int($timestamp) && $timestamp > $now - 3600 && $timestamp <= $now;
    }));
    if (!$times) return 60;
    return max(1, min(3600, min($times) + 3600 - $now));
}
