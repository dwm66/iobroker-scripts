SELECT 
	CASE 
	  WHEN aa.Monat=1 THEN "Januar"
	  WHEN aa.Monat=2 THEN "Februar"
	  WHEN aa.Monat=3 THEN "März"
	  WHEN aa.Monat=4 THEN "April"
	  WHEN aa.Monat=5 THEN "Mai"
	  WHEN aa.Monat=6 THEN "Juni"
	  WHEN aa.Monat=7 THEN "Juli"
	  WHEN aa.Monat=8 THEN "August"
	  WHEN aa.Monat=9 THEN "September"
	  WHEN aa.Monat=10 THEN "Oktober"
	  WHEN aa.Monat=11 THEN "November"
	  WHEN aa.Monat=12 THEN "Dezember"
	END as Monat
    , MAX(if ( aa.mt<'2022-08', aa.Verbrauch, NULL)) as `Verbrauch 2021/2022`
    , MAX(if ( aa.mt<'2022-08', aa.Verbrauch, NULL))*0.8 as `80% Verbrauch 2021/2022` 
    , MAX(if ( aa.mt>'2022-08' AND aa.mt<'2023-08', aa.Verbrauch, NULL)) as `Verbrauch 2022/2023`
    , MAX(if ( aa.mt>'2023-08', aa.Verbrauch, NULL)) as `Verbrauch 2022/2023`
    -- , 
FROM (
SELECT
	GROUP_CONCAT(DISTINCT DATE_FORMAT(from_unixtime(n.ts div 1000),"%m")) as Monat
  , max(n.val)-min(n.val) as `Verbrauch`
  , GROUP_CONCAT(DISTINCT DATE_FORMAT(from_unixtime(n.ts div 1000),"%Y-%m")) as mt
FROM ts_number as n 
left join datapoints as d on d.id = n.id
WHERE 1
	AND (n.ts div 1000) >= UNIX_TIMESTAMP(STR_TO_DATE("2021-10-01 00:00:00","%Y-%m-%d %H:%i:%s"))
	AND (n.ts div 1000) <= UNIX_TIMESTAMP(STR_TO_DATE("2023-04-30 23:59:59","%Y-%m-%d %H:%i:%s"))
	AND n.id = 145
group by DATE_FORMAT(from_unixtime(n.ts div 1000),"%Y-%m")
-- ORDER BY YEARWEEK(from_unixtime(n.ts div 1000),7) asc
) as aa
WHERE NOT (aa.Monat >5 and aa.Monat<9)
GROUP BY aa.Monat
ORDER BY IF(CONVERT(aa.Monat,unsigned)<6,CONVERT(aa.Monat,unsigned)+100,CONVERT(aa.Monat,unsigned)) asc
