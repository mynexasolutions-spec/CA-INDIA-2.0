<?php

namespace App\Support;

/**
 * Shared SpreadsheetML pieces so every Excel export (Client + Admin portals) has the same
 * clean black / white / grey look and prints on one landscape page width.
 */
class ExcelExport
{
    public static function root(): string
    {
        return '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">';
    }

    private static function borders(): string
    {
        $b = '';
        foreach (['Top', 'Bottom', 'Left', 'Right'] as $pos) {
            $b .= '<Border ss:Position="'.$pos.'" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>';
        }

        return '<Borders>'.$b.'</Borders>';
    }

    public static function styles(): string
    {
        $bd = self::borders();
        $center = '<Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>';
        $left = '<Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>';
        $white = '<Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>';
        $s = '<Styles>';
        $s .= '<Style ss:ID="bizName"><Font ss:Bold="1" ss:Size="18" ss:Color="#000000"/><Alignment ss:Horizontal="Center"/></Style>';
        $s .= '<Style ss:ID="bizLine"><Font ss:Size="11" ss:Color="#000000"/><Alignment ss:Horizontal="Center"/></Style>';
        $s .= '<Style ss:ID="bizMeta"><Font ss:Size="11" ss:Color="#000000"/><Alignment ss:Horizontal="Center"/></Style>';
        $s .= '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#000000"/><Alignment ss:Horizontal="Center"/></Style>';
        $s .= '<Style ss:ID="period"><Font ss:Bold="1" ss:Size="11" ss:Color="#000000"/><Alignment ss:Horizontal="Center"/></Style>';
        $s .= '<Style ss:ID="colHead"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF"/><Interior ss:Color="#4B5563" ss:Pattern="Solid"/>'.$center.$bd.'</Style>';
        $s .= '<Style ss:ID="cell"><Font ss:Size="10" ss:Color="#000000"/>'.$white.$center.$bd.'</Style>';
        $s .= '<Style ss:ID="cellLabel"><Font ss:Size="10" ss:Color="#000000"/>'.$white.$left.$bd.'</Style>';
        $s .= '<Style ss:ID="cellMoney"><Font ss:Size="10" ss:Color="#000000"/>'.$white.'<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'.$bd.'<NumberFormat ss:Format="#,##0.00"/></Style>';
        $s .= '<Style ss:ID="totalCell"><Font ss:Bold="1" ss:Size="10" ss:Color="#000000"/>'.$white.$center.$bd.'</Style>';
        $s .= '<Style ss:ID="totalLabel"><Font ss:Bold="1" ss:Size="10" ss:Color="#000000"/>'.$white.$left.$bd.'</Style>';
        $s .= '<Style ss:ID="totalMoney"><Font ss:Bold="1" ss:Size="10" ss:Color="#000000"/>'.$white.'<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>'.$bd.'<NumberFormat ss:Format="#,##0.00"/></Style>';
        $s .= '<Style ss:ID="footer"><Font ss:Size="10" ss:Color="#000000"/><Alignment ss:Horizontal="Left"/></Style>';
        $s .= '</Styles>';

        return $s;
    }

    /** Column widths sized to the longest header / value, so nothing is cut off. */
    public static function cols(array $headers, array $rows): string
    {
        $out = '';
        foreach ($headers as $h) {
            $max = mb_strlen((string) $h) + 4;
            foreach (array_slice($rows, 0, 200) as $row) {
                $v = ((array) $row)[$h] ?? '';
                $max = max($max, mb_strlen(is_scalar($v) ? (string) $v : json_encode($v)) + 2);
            }
            $out .= '<Column ss:AutoFitWidth="0" ss:Width="'.(int) min(max($max * 6.2, 55), 260).'"/>';
        }

        return $out;
    }

    /** Closes the table and sets Landscape + fit-to-one-page-wide printing. */
    public static function end(): string
    {
        return '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">'
            .'<PageSetup><Layout x:Orientation="Landscape"/><PageMargins x:Bottom="0.5" x:Left="0.4" x:Right="0.4" x:Top="0.5"/></PageSetup>'
            .'<FitToPage/><Print><ValidPrinterInfo/><FitWidth>1</FitWidth><FitHeight>0</FitHeight></Print>'
            .'</WorksheetOptions></Worksheet></Workbook>';
    }
}
