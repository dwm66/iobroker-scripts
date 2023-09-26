(SELECT a2.time_group as time_sec, 
(max_value-last)/1000 as value, 
"Photovoltaik (Erzeugung)" as metric 
from (
SELECT a1.*, (
	SELECT
        n1.val as lastmax
        from `ts_number` as n1
        where n1.id=398
        and (n1.ts div 1000) < a1.time_group
        order by n1.ts desc
        limit 1
) as last
FROM (
    SELECT
    GROUP_CONCAT(DISTINCT d.name) as name,
    max(n.val) as max_value,
	case
		when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 3 THEN unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d %H:00:00"))
		when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 7 THEN unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d 00:00:00"))
		when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 364 THEN unix_timestamp(FROM_DAYS(TO_DAYS(from_unixtime(n.ts div 1000))-MOD(TO_DAYS(from_unixtime(n.ts div 1000)) -2, 7)))
		else unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-01 00:00:00"))
	end as time_group
    FROM `ts_number` as n
    left join datapoints as d on d.id = n.id
    WHERE n.id=398
	  and n.ts>$__unixEpochFrom()*1000 and n.ts<=$__unixEpochTo()*1000 
    group by time_group
    order by time_group DESC
) as a1
) as a2
) union (
SELECT a2.time_group as time_sec, 
(max_value-last) as value, 
"Photovoltaik (Erzeugung)" as metric 
from (
SELECT a1.*, (
	SELECT
        n1.val as lastmax
        from `ts_number` as n1
        where n1.id=284
        and (n1.ts div 1000) < a1.time_group
        order by n1.ts desc
        limit 1
) as last
FROM (
    SELECT
    GROUP_CONCAT(DISTINCT d.name) as name,
    max(n.val) as max_value,
	case
		when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 3 THEN unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d %H:00:00"))
		when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 7 THEN unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d 00:00:00"))
		when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 364 THEN unix_timestamp(FROM_DAYS(TO_DAYS(from_unixtime(n.ts div 1000))-MOD(TO_DAYS(from_unixtime(n.ts div 1000)) -2, 7)))
		else unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-01 00:00:00"))
	end as time_group
    FROM `ts_number` as n
    left join datapoints as d on d.id = n.id
    WHERE n.id=284
	and n.ts>$__unixEpochFrom()*1000 and n.ts<=$__unixEpochTo()*1000 
    group by time_group
    order by time_group DESC
) as a1
) as a2
)
ORDER BY time_sec asc
