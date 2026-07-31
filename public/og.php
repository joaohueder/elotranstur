<?php
/**
 * Prévia de compartilhamento (Open Graph) das landing pages — ELO Transporte e Turismo.
 *
 * Como o sistema é uma SPA, o WhatsApp/Facebook/Telegram (que NÃO executam
 * JavaScript) nunca enxergam as metatags geradas no navegador. O .htaccess
 * envia SOMENTE os robôs de prévia para este arquivo, que devolve um HTML
 * estático já com a foto de capa, o título e o subtítulo da viagem.
 *
 * Visitantes reais continuam recebendo a SPA normalmente.
 */

$SUPABASE_URL = 'https://supabase.vps10409.panel.icontainer.cloud';
$SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3ODU0NDkzNjgsImV4cCI6MjEwMDgwOTM2OCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.JJMSkX2HUdP9u1m-2MrOAfOCur5XR5slGLluqT3gwfk';

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$site = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'elotranstur.com.br');

$slug = isset($_GET['slug']) ? trim($_GET['slug']) : '';
$slug = preg_replace('/[^a-zA-Z0-9\-_]/', '', $slug);
$destino = $site . '/v/' . rawurlencode($slug);

function e($v) {
  return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

$viagem = null;
if ($slug !== '') {
  $ch = curl_init($SUPABASE_URL . '/rest/v1/rpc/landing_viagem');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'apikey: ' . $SUPABASE_ANON_KEY,
      'Authorization: Bearer ' . $SUPABASE_ANON_KEY,
    ],
    CURLOPT_POSTFIELDS => json_encode(['_slug' => $slug]),
  ]);
  $resposta = curl_exec($ch);
  curl_close($ch);
  if ($resposta) {
    $json = json_decode($resposta, true);
    if (is_array($json)) $viagem = $json;
  }
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');

if (!$viagem) {
  http_response_code(404);
  echo '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
    . '<title>Viagem não encontrada</title>'
    . '<meta http-equiv="refresh" content="0;url=' . e($site) . '"></head><body></body></html>';
  exit;
}

$titulo = $viagem['titulo'] ?: ($viagem['destino'] ?: 'Viagem');
$subtitulo = $viagem['subtitulo'] ?? '';
$descricao = trim(implode(' — ', array_filter([$titulo, $subtitulo])));
if ($descricao === '') {
  $descricao = mb_substr((string)($viagem['descricao'] ?? ''), 0, 155);
}

$imagem = '';
$imagens = is_array($viagem['imagens'] ?? null) ? $viagem['imagens'] : [];
foreach ($imagens as $img) {
  if (!empty($img['capa']) && !empty($img['url'])) { $imagem = $img['url']; break; }
}
if ($imagem === '' && !empty($imagens[0]['url'])) $imagem = $imagens[0]['url'];
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($titulo) ?></title>
<meta name="description" content="<?= e($descricao) ?>">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ELO Transporte e Turismo">
<meta property="og:title" content="<?= e($titulo) ?>">
<meta property="og:description" content="<?= e($descricao) ?>">
<meta property="og:url" content="<?= e($destino) ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= e($titulo) ?>">
<meta name="twitter:description" content="<?= e($descricao) ?>">
<?php if ($imagem !== ''): ?>
<meta property="og:image" content="<?= e($imagem) ?>">
<meta property="og:image:secure_url" content="<?= e($imagem) ?>">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="<?= e($imagem) ?>">
<?php endif; ?>
<link rel="canonical" href="<?= e($destino) ?>">
</head>
<body>
<p>Abrindo a página da viagem…</p>
<a href="<?= e($destino) ?>"><?= e($titulo) ?></a>
<script>location.replace(<?= json_encode($destino) ?>);</script>
</body>
</html>
