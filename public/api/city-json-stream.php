<?php

// Validate JSON without decoding a collection or its five snapshots into memory.
final class CityJsonStream {
    private $stream;
    private string $buffer = '';
    private int $index = 0;
    private int $position = 0;

    public function __construct($stream) {
        $this->stream = $stream;
    }

    private function peek(): string {
        if ($this->index >= strlen($this->buffer)) {
            $buffer = fread($this->stream, 65536);
            if ($buffer === false) throw new RuntimeException('Lecture du stockage impossible.');
            $this->buffer = $buffer;
            $this->index = 0;
        }
        return $this->buffer[$this->index] ?? '';
    }

    private function advance(int $length = 1): void {
        $this->index += $length;
        $this->position += $length;
    }

    private function expect(string $character): void {
        if ($this->peek() !== $character) throw new UnexpectedValueException('JSON invalide.');
        $this->advance();
    }

    private function whitespace(): void {
        while ($this->peek() !== '') {
            $length = strspn($this->buffer, " \t\r\n", $this->index);
            if (!$length) return;
            $this->advance($length);
        }
    }

    private function string(): string {
        $this->expect('"');
        $token = '"';
        while (true) {
            $character = $this->peek();
            if ($character === '') throw new UnexpectedValueException('Chaîne JSON incomplète.');
            $length = strcspn($this->buffer, "\\\"", $this->index);
            $token .= substr($this->buffer, $this->index, $length);
            $this->advance($length);
            if (strlen($token) > 16 * 1024 * 1024) {
                throw new LengthException('Un champ du stockage dépasse 16 Mo. Aucun fichier ne sera remplacé.');
            }
            $character = $this->peek();
            if ($character === '') throw new UnexpectedValueException('Chaîne JSON incomplète.');
            $token .= $character;
            $this->advance();
            if ($character === '"') break;
            if ($character === '\\') {
                $escaped = $this->peek();
                if ($escaped === '') throw new UnexpectedValueException('Échappement JSON incomplet.');
                $token .= $escaped;
                $this->advance();
            }
        }
        $value = json_decode($token, true, 512, JSON_THROW_ON_ERROR);
        if (!is_string($value)) throw new UnexpectedValueException('Chaîne JSON invalide.');
        return $value;
    }

    private function value(int $depth): void {
        if ($depth > 512) throw new UnexpectedValueException('JSON trop imbriqué.');
        $this->whitespace();
        $character = $this->peek();
        if ($character === '"') {
            $this->string();
        } elseif ($character === '{' || $character === '[') {
            $object = $character === '{';
            $end = $object ? '}' : ']';
            $this->advance();
            $this->whitespace();
            if ($this->peek() !== $end) {
                while (true) {
                    if ($object) {
                        $this->string();
                        $this->whitespace();
                        $this->expect(':');
                    }
                    $this->value($depth + 1);
                    $this->whitespace();
                    if ($this->peek() !== ',') break;
                    $this->advance();
                    $this->whitespace();
                }
            }
            $this->expect($end);
        } elseif ($character === 't' || $character === 'f' || $character === 'n') {
            $literal = $character === 't' ? 'true' : ($character === 'f' ? 'false' : 'null');
            foreach (str_split($literal) as $letter) $this->expect($letter);
        } else {
            $token = '';
            while (($character = $this->peek()) !== '' && strpos('-+0123456789.eE', $character) !== false) {
                $token .= $character;
                $this->advance();
                if (strlen($token) > 1024) throw new UnexpectedValueException('Nombre JSON invalide.');
            }
            if (!preg_match('/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/D', $token)) {
                throw new UnexpectedValueException('Valeur JSON invalide.');
            }
        }
    }

    public function entries(bool $pages): array {
        $this->whitespace();
        $start = $this->peek();
        // Historical empty page maps may be [].
        if ($pages && $start === '[') {
            $this->advance();
            $this->whitespace();
            $this->expect(']');
            $this->finish();
            return [];
        }
        $this->expect($pages ? '{' : '[');
        $end = $pages ? '}' : ']';
        $entries = [];
        $this->whitespace();
        if ($this->peek() !== $end) {
            while (true) {
                $key = count($entries);
                if ($pages) {
                    $key = $this->string();
                    $this->whitespace();
                    $this->expect(':');
                    $this->whitespace();
                }
                $offset = $this->position;
                $null = $this->peek() === 'n';
                $this->value(1);
                $entries[$key] = ['offset' => $offset, 'length' => $this->position - $offset, 'null' => $null];
                $this->whitespace();
                if ($this->peek() !== ',') break;
                $this->advance();
                $this->whitespace();
            }
        }
        $this->expect($end);
        $this->finish();
        return $entries;
    }

    private function finish(): void {
        $this->whitespace();
        if ($this->peek() !== '') throw new UnexpectedValueException('Données après le JSON.');
    }
}

function cityJsonEntries($stream, bool $pages): array {
    if (fseek($stream, 0) !== 0) throw new RuntimeException('Lecture du stockage impossible.');
    return (new CityJsonStream($stream))->entries($pages);
}

function cityJsonWrite($output, string $text): void {
    $length = strlen($text);
    $offset = 0;
    while ($offset < $length) {
        $written = fwrite($output, substr($text, $offset));
        if ($written === false || $written === 0) throw new RuntimeException('Écriture du stockage impossible.');
        $offset += $written;
    }
}

function cityJsonCopy($input, $output, array $entry): void {
    if (fseek($input, $entry['offset']) !== 0
        || stream_copy_to_stream($input, $output, $entry['length']) !== $entry['length']) {
        throw new RuntimeException('Copie du stockage impossible. Vérifiez les droits et l’espace disque.');
    }
}
