-- test query for a datapoint in ts_numbers
SELECT n.*
, d.name 
, from_unixtime(n.ts div 1000) as timestamp
, unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d %H:00:00")) as time_group_hour
, unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d 00:00:00")) as time_group_day
, unix_timestamp(FROM_DAYS(TO_DAYS(from_unixtime(n.ts div 1000))-MOD(TO_DAYS(from_unixtime(n.ts div 1000)) -2, 7))) as time_group_week
, unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-01 00:00:00")) as time_group_month
FROM `ts_number` as n
left join datapoints as d on d.id = n.id
WHERE n.id=398
-- WHERE d.name="javascript.0.Senec.Statistic.LIVE_PV_GEN"
order by n.ts desc


-- 
