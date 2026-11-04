import React from 'react';

type Props = { value: unknown };
export const OperationValue: React.FC<Props> = ({ value }) => {
  if (Array.isArray(value)) {
    return (
      <ul>
        {value.map((item, index) => (
          <li key={index}>
            <OperationValue value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <dl>
        {Object.entries(value).map(([key, item]) => (
          <React.Fragment key={key}>
            <dt>{key}</dt>
            <dd>
              <OperationValue value={item} />
            </dd>
          </React.Fragment>
        ))}
      </dl>
    );
  }

  return <span>{value == null ? '—' : String(value)}</span>;
};
