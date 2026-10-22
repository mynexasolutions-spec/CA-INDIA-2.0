<?php

namespace App\Services\DocumentTemplate;

/**
 * Clients upload logos / seals / signatures of 1000+ px (often transparent PNGs) that a document prints about an
 * inch wide. dompdf decodes a PNG pixel by pixel in PHP (alpha channels are the slow part) but embeds a JPEG as it
 * is, so every transparent PNG added seconds to a render and megabytes to the PDF.
 *
 * This hands dompdf a downscaled, flattened-on-white JPEG copy instead (the document page is white), cached on
 * disk and keyed by the source file's path, size and modification time. A JPEG that is already small is left as is.
 */
class PdfImage
{
    public static function shrink(?string $path, int $maxPx = 600): ?string
    {
        if (! $path || ! is_file($path) || ! function_exists('imagecreatetruecolor')) {
            return $path;
        }

        try {
            $info = @getimagesize($path);
            if (! $info || ! in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_JPEG], true)) {
                return $path;
            }
            if ($info[2] === IMAGETYPE_JPEG && max($info[0], $info[1]) <= $maxPx) {
                return $path;
            }

            $dir = storage_path('app/pdf-image-cache');
            $target = $dir.DIRECTORY_SEPARATOR.md5($path.'|'.filesize($path).'|'.filemtime($path).'|'.$maxPx.'|j1').'.jpg';
            if (is_file($target)) {
                return $target;
            }
            if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
                return $path;
            }

            $src = $info[2] === IMAGETYPE_PNG ? @imagecreatefrompng($path) : @imagecreatefromjpeg($path);
            if (! $src) {
                return $path;
            }

            $scale = min(1, $maxPx / max($info[0], $info[1]));
            $w = max(1, (int) round($info[0] * $scale));
            $h = max(1, (int) round($info[1] * $scale));
            $dst = imagecreatetruecolor($w, $h);
            imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $w, $h, $info[0], $info[1]);

            // Write to a temp name first so a concurrent request never reads a half-written file.
            $tmp = $target.'.'.getmypid().'.tmp';
            if (imagejpeg($dst, $tmp, 90) && @rename($tmp, $target)) {
                return $target;
            }
            @unlink($tmp);
        } catch (\Throwable $e) {
            // fall through to the original
        }

        return $path;
    }
}
