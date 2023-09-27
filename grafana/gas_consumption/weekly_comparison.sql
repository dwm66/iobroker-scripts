-- query to create a bar graph comparing consumption in the reference period 2021/22
-- attention:
-- this query has a small bug: it neglects the first entry after entering a new period.
-- as the consumption counter works in the time scale of minutes and we are looking here
-- at weeks, the error is neglectable.
SELECT ab.Woche as Woche
		-- special construction, as my data for week 2 2020 is invalid
	   , IF(ab.Woche != 2,
            (`ab`.`Verbrauch 2018/2019` + `ab`.`Verbrauch 2019/2020` + `ab`.`Verbrauch 2020/2021` + `ab`.`Verbrauch 2021/2022`)/4,
            (`ab`.`Verbrauch 2018/2019` + `ab`.`Verbrauch 2020/2021` + `ab`.`Verbrauch 2021/2022`)/3
            ) as `Refererence 2018-2021`
       , `ab`.`Verbrauch 2022/2023` as `Verbrauch 2022/2023`
       , `ab`.`Verbrauch 2023/2024` as `Verbrauch 2023/2024`
FROM
    (
        SELECT 
        aa.Woche as Woche
        , MAX(if ( aa.wk>201830 AND aa.wk<201930, aa.Verbrauch, NULL)) as `Verbrauch 2018/2019`
        , MAX(if ( aa.wk>201930 AND aa.wk<202030, aa.Verbrauch, NULL)) as `Verbrauch 2019/2020`
        , MAX(if ( aa.wk>202030 AND aa.wk<202130, aa.Verbrauch, NULL)) as `Verbrauch 2020/2021`
        , MAX(if ( aa.wk>202130 AND aa.wk<202230, aa.Verbrauch, NULL)) as `Verbrauch 2021/2022`
        , MAX(if ( aa.wk>202230 AND aa.wk<202330, aa.Verbrauch, NULL)) as `Verbrauch 2022/2023`
        , MAX(if ( aa.wk>202330 AND aa.wk<202430, aa.Verbrauch, NULL)) as `Verbrauch 2023/2024`
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
WHERE woche<53
ORDER BY IF(CONVERT(ab.Woche,unsigned)<35,CONVERT(ab.Woche,unsigned)+100,CONVERT(ab.Woche,unsigned)) ASC
