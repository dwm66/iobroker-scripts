(SELECT 
  case
    when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 3 THEN unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d %H:00:00"))
    when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 7 THEN unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d 00:00:00"))
    when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 364 THEN unix_timestamp(FROM_DAYS(TO_DAYS(from_unixtime(n.ts div 1000))-MOD(TO_DAYS(from_unixtime(n.ts div 1000)) -2, 7)))
    else unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-01 00:00:00"))
  end as time_sec, 
(max(n.val)-min(n.val))/1000 as value, 
"Photovoltaik (Erzeugung)" as metric 
FROM ts_number as n 
left join datapoints as d on d.id = n.id
WHERE n.ts>$__unixEpochFrom()*1000 and n.ts<=$__unixEpochTo()*1000 
and n.id=398
group by time_sec 
ORDER BY `time_sec` asc)
union (
SELECT 
  case
    when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 3 THEN unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d %H:00:00"))
    when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 7 THEN unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-%d 00:00:00"))
    when $__unixEpochTo() - $__unixEpochFrom() <= 86400 * 364 THEN unix_timestamp(FROM_DAYS(TO_DAYS(from_unixtime(n.ts div 1000))-MOD(TO_DAYS(from_unixtime(n.ts div 1000)) -2, 7)))
    else unix_timestamp(date_format(from_unixtime(n.ts div 1000),"%Y-%m-01 00:00:00"))
  end as time_sec, 
(max(n.val)-min(n.val)) as value, 
"Photovoltaik (Erzeugung)" as metric 
FROM ts_number as n 
left join datapoints as d on d.id = n.id
WHERE n.ts>$__unixEpochFrom()*1000 and n.ts<=$__unixEpochTo()*1000 
and n.id=284
group by time_sec 
ORDER BY `time_sec` asc
)
