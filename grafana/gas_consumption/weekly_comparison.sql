-- query to create a bar graph comparing consumption in the reference period 2021/22
-- attention:
-- this query has a small bug: it neglects the first entry after entering a new period.
-- as the consumption counter works in the time scale of minutes and we are looking here
-- at weeks, the error is neglectable.
SELECT
	ad.Woche,
    ad.ref as `Referenz 2018-2021`,
    ad.v2022 as `Verbrauch 2022/2023`,
    ad.v2023 as `Verbrauch 2023/2024`
FROM (
	SELECT 
		ac.Woche,
    	ac.v2018,ac.v2019,ac.v2020,ac.v2021,
    	-- ac.*,
    	(IF(ISNULL(ac.v2018),0,ac.v2018)+IF(ISNULL(ac.v2019),0,ac.v2019)+ac.v2020+ac.v2021)/(ac.cnt2018+ac.cnt2019+ac.cnt2020+ac.cnt2021) as ref,
    	ac.v2022,
    	ac.v2023
	FROM
	( 
		SELECT ab.Woche as Woche
			, ab.v2018
			, IF ( ISNULL(ab.v2018),0,1) as `cnt2018`
			, ab.v2019
			, IF ( ISNULL(ab.v2019),0,1) as `cnt2019`
			, ab.v2020
			, IF ( ISNULL(ab.v2020),0,1) as `cnt2020`
			, ab.v2021
			, IF ( ISNULL(ab.v2021),0,1) as `cnt2021`
			, ab.v2022
			, ab.v2023
	FROM
		(
			SELECT 
			aa.Woche as Woche
			, MAX(if ( aa.wk>201830 AND aa.wk<201930, aa.Verbrauch, IF(aa.Woche>45 OR aa.Woche<9,NULL,0) )) as v2018
			, MAX(if ( aa.wk>201930 AND aa.wk<202030, aa.Verbrauch, IF(aa.Woche>45 OR aa.Woche<9,NULL,0))) as v2019
			, MAX(if ( aa.wk>202030 AND aa.wk<202130, aa.Verbrauch, IF(aa.Woche>45 OR aa.Woche<9,NULL,0))) as v2020
			, MAX(if ( aa.wk>202130 AND aa.wk<202230, aa.Verbrauch, IF(aa.Woche>45 OR aa.Woche<9,NULL,0))) as v2021
			, MAX(if ( aa.wk>202230 AND aa.wk<202330, aa.Verbrauch, IF(aa.Woche>45 OR aa.Woche<9,NULL,0))) as v2022
			, MAX(if ( aa.wk>202330 AND aa.wk<202430, aa.Verbrauch, IF(aa.Woche>45 OR aa.Woche<9,NULL,0))) as v2023
			-- , 
			FROM (
				SELECT
				GROUP_CONCAT(DISTINCT CONVERT(WEEK(from_unixtime(n.ts div 1000),7),char)) as Woche
				, max(n.val)-min(n.val) as `Verbrauch`
				, YEARWEEK(from_unixtime(n.ts div 1000),7) as wk
				FROM ts_number as n 
				left join datapoints as d on d.id = n.id
				WHERE 1
				AND (n.ts div 1000) >= UNIX_TIMESTAMP(STR_TO_DATE("2018-10-01 00:00:00","%Y-%m-%d %H:%i:%s"))
				AND (n.ts div 1000) <= UNIX_TIMESTAMP(STR_TO_DATE("2024-04-30 23:59:59","%Y-%m-%d %H:%i:%s"))
				AND n.id = 145
				group by YEARWEEK(from_unixtime(n.ts div 1000),7)
				-- ORDER BY YEARWEEK(from_unixtime(n.ts div 1000),7) asc
			) as aa
			WHERE NOT (aa.Woche >20
			and aa.Woche<37)
			GROUP BY aa.Woche
		) as ab
	) as ac
) as ad
WHERE woche<53
ORDER BY IF(CONVERT(ad.Woche,unsigned)<35,CONVERT(ad.Woche,unsigned)+100,CONVERT(ad.Woche,unsigned)) ASC
